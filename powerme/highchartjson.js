const moment = require('moment');
const _ = require('lodash');
const CHART_COLORS = [
  "#e20074",
  "#009688",
  "#e91e63",
  "#673ab7",
  "#2196f3",
  "#00bcd4",
  "#4caf50",
  "#ffc107",
  "#795548",
  "#9e9e9e",
  "#a8a8ad",
  "#000000",
  "#481490",
  "#f44336",
  "#775b46",
  "#90141e"
];

module.exports = {
  getJson: function (req, res) {
    var resultJson = getDashboardJson(req)
    res.send(resultJson)
  },

  getContributorsJson: function (req, res) {
    var resultJson = getContributorsJson(req)
    res.send(resultJson)
  },

  getProfilingJson : function(req,res){
    var resultJson = getProfilingJson(req.body)
    res.send(resultJson)
  },
  
  getDistinctnessJson : function(req,res){
    var resultJson = getDistinctnessJson(req.body)
    res.send(resultJson)
  }
}
var anomaly = {};
var timeFormat = "YYYY-MM-DD"

getDistinctnessJson = (data) => { 
 
  const buckets = data.metric.aggregations.asMap;
  var aggregatorKey =  data.aggValue;
  var esResponse = [
    {
      name: _.get(buckets, ["tophit", "hits", "hits", "0", "source", "name"], "NA"),
      hits: !isNullOrUndefined(aggregatorKey)
        ? buckets.agg_rule_values.buckets.map(hits => {
            return {
              tmst: hits.key,
              value: hits.aggregations.asMap.metric_agg.aggregations.asMap.rule_names.buckets
                .map(hit => {
                  return {
                    [hit.key]: _.get(
                      hit,
                      [
                        "aggregations",
                          "asMap",
                        "agg_list",
                        "aggregations",
                          "asMap",
                        "aggregator_key_list",
                        "buckets",
                        "0",
                       
                        "buckets",
                        "0",
                        "key"
                      ],
                      0
                    ),
                    ...["total","distinct"].reduce(function(acc, cur) {
                      acc[ hit.key + "_" + cur] = _.get(
                        hit,
                        ["aggregations",
                        "asMap","agg_list","aggregations",
                        "asMap", "aggregator_key_list", "buckets", "0","aggregations",
                        "asMap", cur, "value"],
                        undefined
                      );
                      return acc;
                    }, {})
                  };
                })
                .reduce((result, current) => {
                  return Object.assign(result, removeNullValues(current));
                }, {})
            };
          })
        : buckets.basic_rule_values.hits.hits.map(hit => hit.source),
      args: buckets.tophit.hits.hits.map(hit => hit.source.sinkArgs)
    }
  ];
  return distinctnessChartOption(esResponse[0]);
};
 
 distinctnessChartOption = (metric) => {
  const chart = getChartOptions("Duplicate Count", "Distinct & Total Count");
  formatter(chart, metric);
 
  if (metric.args && metric.args.length !== 0) {
    aggregateBy =
      metric.args[0].aggregatorAlias && metric.args[0].aggregatorAlias.trim().length > 0
        ? metric.args[0].aggregatorAlias.trim()
        : metric.args[0].aggregateBy;
  }
  if (metric.hits.length) {
    const val = processRequest(metric.hits[0].value, "distinctness");
    val.forEach(i => {
      const name = getTitle(i);
      chart.series.push({
        dataGrouping: {
          enabled: false
        },
        type: "column",
        name: `${name} total`,
        yAxis: 1,
        data: metric.hits.map(hit => {
          return {
            x: hit.tmst,
            y: hit.value[i + "_dup"].total
              ? hit.value[i + "_dup"].total
              : hit.value[i + "_dup_total"]
          };
        })
      });
      chart.series.push({
        type: "spline",
        name: `${name} distinct`,
        yAxis: 1,
        data: metric.hits.map(hit => {
          return {
            x: hit.tmst,
            y: hit.value[i + "_dup"].distinct
              ? hit.value[i + "_dup"].distinct
              : hit.value[i + "_dup_distinct"]
          };
        })
      });
      chart.series.push({
        type: "spline",
        name: `${name} duplicate`,
        yAxis: 0,
        data: metric.hits.map(hit => {
          return {
            x: hit.tmst,
            y:
              (hit.value[i + "_dup"].total
                ? hit.value[i + "_dup"].total
                : hit.value[i + "_dup_total"]) -
              (hit.value[i + "_dup"].distinct
                ? hit.value[i + "_dup"].distinct
                : hit.value[i + "_dup_distinct"])
          };
        })
      });
    });
  }
  return chart;
}
getTitle = function(name) {
  const temp = name.split("__");
  if (temp.length > 1) {
    temp[1] = temp[1].replace(/_/g, " ");
    return temp.join(" ");
  } else {
    return name.replace(/_/g, " ");
  }
};
 
 processRequest = function(item, type) {
  switch (type) {
    case "validity": {
      return Object.keys(item)
        .filter(i => {
          return i.endsWith("_total_count");
        })
        .map(i => i.replace("_total_count", ""));
    }
    case "completeness": {
      return Object.keys(item)
        .filter(i => {
          return i.endsWith("_null_check");
        })
        .map(i => i.replace("_null_check", ""));
    }
    case "distinctness": {
      return Object.keys(item)
        .filter(i => {
          return i.endsWith("_dup");
        })
        .map(i => i.replace("_dup", ""));
    }
  }
}
removeNullValues = function(current) {
  for (let val in current) {
    if (current[val] == null) {
      delete current[val];
    }
  }
  return current;
}

getDashboardJson = (req) => {
  value = req.body.data
  anomaly = req.body.anomaly
  timeFormat = anomaly.details.dateFormat ?  anomaly.details.dateFormat : timeFormat;
  console.log("Time format :: ", timeFormat)
  
  seriesOptions = [];
  val = value.map(i => {

    i.anomaly_flag = i.score == "HIGH";
    return i;
  });
  return drawAnomalygraph(val);
}

capitalize = (input) => {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

addSeries = (data, dataFunc, type, tooltp, name, color, opacity = 1, matured = false) => {

  let subtitle = "";

  let tooltip = tooltp;

  if (name && name == "expected_upper_limit") {

    subtitle = " Upper limit ";

    tooltip = {

      headerFormat: '<span style="font-size:10px">{point.key}</span>',

      pointFormat:

        '<div style="color:#223c61;padding:0">{series.name}:</div><div><b>{point.y}</b></div> ',

      footerFormat: "",

      split: false

    };

  } else if (name && name == "expected_lower_limit") {

    subtitle = " Lower limit ";

    tooltip = {

      headerFormat: '<span style="font-size:10px">{point.key}</span>',

      pointFormat:

        '<div style="color:#223c61;padding:0">{series.name}:</div><div><b>{point.y}</b></div>',

      footerFormat: "",

      split: false

    };

  } else if (name) {

  } else {

    subtitle = " limit ";

    tooltip = {

      headerFormat: '<span style="font-size:10px">{point.key}</span>',

      pointFormat:

        '<div style="color:#223c61;padding:0">{series.name}:</div><div><b>{point.low}  <span class="mx-1">to</span>  {point.high}</b></div>',

      footerFormat: "",

      split: false

    };

  }

  const chart = {

    desc: anomaly.details.medianColumn + subtitle,

    yAxis: [

      {

        name: anomaly.details.medianColumn + subtitle,

        type: type,

        title: capitalize(anomaly.details.medianColumn + subtitle),

        formatter: function () {

          let result = value;

          if (value >= 1000000000000000000) {
            result = Math.floor(value / 1000000000000000000) + "Qi";
          } else if (value >= 1000000000000000) {
            result = Math.floor(value / 1000000000000000) + "Qa";
          } else if (value >= 1000000000000) {
            result = Math.floor(value / 1000000000000) + "T";
          } else if (value >= 1000000000) {
            result = Math.floor(value / 1000000000) + "B";
          } else if (value >= 1000000) {
            result = Math.floor(value / 1000000) + "M";
          } else if (value >= 1000) {
            result = Math.floor(value / 1000) + "K";
          }

          return result;

        },

        axis: 0

      }

    ]

  };

  const axis = chart.yAxis[0];

  const field = anomaly.details.groupByList[0];

  let series = {

    id: axis.name,

    axisData: axis,

    chartData: chart,

    marker: {

      enabled: true,

      radius: 2

    },

    tooltip: tooltip,

    name: axis.title,

    type: axis.type,

    yAxis: axis.axis,

    data: dataFunc(data, field, name),

    showInLegend: subtitle == "" || matured

  };

  if (color) {

    series.color = color;

  }

  if (opacity) {

    series.fillOpacity = opacity

  }

  seriesOptions.push(series);

};

plotLine = (data, field, name) => {

  return data.map(function (rec) {

    const obj = {

      ...rec,

      x: moment.utc(rec[field], timeFormat).valueOf(),

      name: moment(rec[field], timeFormat).format(timeFormat),

      y: +rec[name].toFixed(2)
    };



    if (name !== "expected_upper_limit" && name !== "expected_lower_limit" && rec.anomaly_flag) {

      obj.color = "black";

      obj.marker = {

        enabled: true,

        radius: 4

      };

    }



    if (

      name !== "expected_upper_limit" &&

      name !== "expected_lower_limit" &&

      rec.anomalous_point

    ) {

      obj.color = "orange";

      obj.marker = {

        enabled: true,

        radius: 4

      };

    }

    return obj;

  });

};

plotArearange = (data, field) => {

  return data.map(function (rec, index) {

    const obj = {

      ...rec,

      name: moment(rec[field], timeFormat).format(timeFormat),

      x: moment.utc(rec[field], timeFormat).valueOf(),

      high: +rec.expected_upper_limit.toFixed(2),

      low: +rec.expected_lower_limit.toFixed(2)

    };

    return obj;

  });

};

getDashboard = (value) => {
  value.map(i => {

    i.anomaly_flag = i.score == "HIGH";

    return i;

    drawAnomalygraph(val);

  });
};

getAnomalyDetailByLevel = (req, score) => {

  if (score) {

    return http.post(config.uri.getAnomalyScore, req);

  } else {

    return http.post(config.uri.getAnomalyData, req);

  }

};

getAnomalyAggList = (anomaly, index) => {

  if (!isNullOrUndefined(index) && checkForAnomaly(anomaly, index)) {

    return anomaly.details.groupByList.slice(0, index + 1);

  } else {

    return anomaly.details.groupByList;

  }

};

checkForAnomaly = (anomaly, index) => {

  return anomaly.details.adGroupByList.indexOf(anomaly.details.groupByList[index]) !== -1;

};

drawAnomalygraph = val => {

  let response = val.sort((a, b) => {

    if (a[anomaly.details.groupByList[0]] > b[anomaly.details.groupByList[0]]) {

      return 1;

    } else if (a[anomaly.details.groupByList[0]] < b[anomaly.details.groupByList[0]]) {

      return -1;

    }

    return 0;

  });

  const tooltip = {

    headerFormat: '<span style="font-size:10px">{point.key}</span>',

    pointFormat:

      '<div style="color:{series.color};padding:0">{series.name}: ' +

      "<b>{point.y}</b></div>" +

      (checkForAnomaly(anomaly, anomaly.level || 0)

        ?
        '<div style="color:{series.color};padding:0">Confidence Score: <b>{point.score}</b></div>'

        :
        ""),

    footerFormat: "",

    split: false

  };

  addSeries(response, plotLine, "spline", tooltip, anomaly.details.medianColumn);

  if (

    checkForAnomaly(anomaly, anomaly.level || 0) &&

    (anomaly.details.considerLowerLimit && anomaly.details.considerUpperLimit)

  ) {

    drawTrainingRegion(response, "areasplinerange", undefined);

  } else if (

    checkForAnomaly(anomaly, anomaly.level || 0) &&

    anomaly.details.considerLowerLimit

  ) {

    drawTrainingRegion(response, "spline", "expected_lower_limit");

  } else if (

    checkForAnomaly(anomaly, anomaly.level || 0) &&

    anomaly.details.considerUpperLimit

  ) {

    drawTrainingRegion(response, "spline", "expected_upper_limit");

  }

  return drawCharts({
    desc: anomaly.details.medianColumn,
    timeFormat : timeFormat,
    yAxis: [{
      axis: 0
    }]
  });

};

drawTrainingRegion = (response, type, name) => {

  const tooltip = {

    split: false

  };

  if (response.length > 20) {

    let secondSet = response.slice(19);

    let firstSet = response.slice(0, 20);

    addSeries(

      firstSet,

      type !== "spline" ? plotArearange : plotLine,

      type,

      tooltip,

      name,

      "#e1f5fe",

      0.5

    );

    addSeries(

      secondSet,

      type !== "spline" ? plotArearange : plotLine,

      type,

      tooltip,

      name,

      "#b3e5fc",

      0.5,

      true

    );

  } else {

    addSeries(

      response,

      type !== "spline" ? plotArearange : plotLine,

      type,

      tooltip,

      name,

      "#e1f5fe",

      0.5

    );

  }

};

drawCharts = (element) => {

  return timelineColumnChart(element);

};

timelineColumnChart = (element) => {

  const options = {

    credits: {

      enabled: false

    },

    colors: CHART_COLORS,

    title: {

      text: element.desc,

      align: "left"

    },

    subtitle: {

      text: "",

      align: "left"

    },

    scrollbar: {

      enabled: false

    },

    legend: {

      enabled: true,

      layout: "vertical",

      backgroundColor: "#FFFFFF",

      align: "right",

      verticalAlign: "top",

      floating: true,

      y: 15

    },



    xAxis: {

      categories: [],

      crosshair: true

    },

    yAxis: _.uniqBy(element.yAxis, "axis").map(axis => {

      const obj = {


        title: {

          text: axis.title

        }

      };



      if (axis.formatter) {

        obj.labels = {

          formatter: axis.formatter

        };

      }



      return obj;

    }),

    tooltip: {

      valueDecimals: element.decimals,

      valueSuffix: element.suffix,

      outside: true,

      shared: true,

      useHTML: true

    },

    plotOptions: {

      column: {

        pointPadding: 0.2,

        borderWidth: 0

      },

      series: {

        cursor: "pointer",

        marker: {

          states: {

            select: {

              fillColor: undefined,

              radius: 6,

              lineWidth: 1

            }

          }

        }

      }

    },

    navigator: {

      enabled: true

    },

    rangeSelector: {

      buttons: [

        {

          type: "day",

          count: 1,

          text: "1D"

        },

        {

          type: "week",

          count: 1,

          text: "1W"

        },

        {

          type: "month",

          count: 1,

          text: "1M"

        },

        {

          type: "month",

          count: 3,

          text: "3M"

        },

        {

          type: "ytd",

          text: "YTD"

        },

        {

          type: "year",

          count: 1,

          text: "1y"

        },

        {

          type: "all",

          count: 1,

          text: "All"

        }

      ],

      selected: 2,

      inputEnabled: false

    },



    series: []

  };

if(element.timeFormat && element.timeFormat === 'YYYY-MM-DD HH:mm') {
  options.rangeSelector.buttons.splice(1, 0, {

    type: "day",
  
    count: 2,
  
    text: "2D"
  
  });
  options.rangeSelector.selected = 1;
}

  options.legend = {

    enabled: true,

    backgroundColor: "#FFFFFF",

    verticalAlign: "bottom",

    y: 15

  };



  options.chart = {

    height: 470

  };



  seriesOptions[0].zIndex = 10;

  seriesOptions[0].allowPointSelect = true;

  options.series = [...seriesOptions];

  return options

  

};

getChartOptions = (y1AxisName, y2AxisName) => {

  const chartOpts = {

    colors: CHART_COLORS,

    title: {

      text: ""

    },

    credits: {

      enabled: false

    },

    subtitle: {

      text: "",

      align: "left"

    },

    scrollbar: {

      enabled: false

    },

    legend: {

      enabled: true,

      backgroundColor: "#FFFFFF",

      verticalAlign: "bottom",

      layout: "horizontal"

    },



    xAxis: {

      categories: [],

      crosshair: true

    },



    yAxis: [

      {


        title: {

          text: y1AxisName,

          style: {

            color: CHART_COLORS[1]

          },

          margin: 25

        },

        labels: {

          x: 20

        },

        offset: 30

      },

      {


        title: {

          text: y2AxisName

        },

        opposite: false

      }

    ],

    tooltip: {

      headerFormat: '<span style="font-size:10px">{point.key}</span><table>',

      pointFormat:

        '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +

        '<td style="padding:0"><b>{point.y}</b></td></tr>',

      footerFormat: "</table>",

     shared: true,

      useHTML: true,

      split: false

    },

    plotOptions: {

      column: {

        pointPadding: 0.2,

        borderWidth: 0

      },

      series: {

        showInNavigator: true

      }

    },

    rangeSelector: {

      buttons: [

        {

          type: "day",

          count: 1,

          text: "1D"

        },

        {

          type: "week",

          count: 1,

          text: "1W"

        },

        {

          type: "month",

          count: 1,

          text: "1M"

        },

        {

          type: "month",

          count: 3,

          text: "3M"

        },

        {

          type: "ytd",

          text: "YTD"

        },

        {

          type: "year",

          count: 1,

          text: "1y"

        },

        {

          type: "all",

          count: 1,

          text: "All"

        }

      ],

      selected: 6,

      inputEnabled: false

    },

    series: [],

    exporting: {

      enabled: false

    }

  };

  return chartOpts;

};

profilingChartOption = (metric ) => {

  const chart = getChartOptions("Value", "Deviation & Ratio");

  chart.rangeSelector.buttons.splice(1, 0, {

    type: "day",

    count: 2,

    text: "2D"

  });

  chart.rangeSelector.selected = 7;

  if (metric.hits.length >= 2) {

    let firstHit = moment(metric.hits[0].tmst);

    let secondHit = moment(metric.hits[1].tmst);

    let duration = moment.duration(secondHit.diff(firstHit));

    let hours = duration.asHours();

    if (hours <= 24) {

      chart.rangeSelector.selected = 1;

    }

  }

  formatter(chart, metric);

  const seriesMap = {};

  let aggregateBy;


  if (metric.args.length !== 0) {

    aggregateBy = metric.args[0].aggregateBy;

  }

  console.log("")

  metric.hits.forEach(hit => {

    if (hit.value) {


      const graphMetrics = Object.keys(hit.value)

        .filter(key => !isNullOrUndefined(hit.value[key]) && hit.value[key] != '-Infinity' && hit.value[key] != 'Infinity')

        .sort();


      graphMetrics.forEach(key => {

        const isDeviationRule = /(ratio|deviation|deviation_dow)$/.test(key);

        if (!seriesMap.hasOwnProperty(key)) {

          seriesMap[key] = {

            dataGrouping: {

              enabled: false

            },

            type: isDeviationRule ? "spline" : "column",

            yAxis: isDeviationRule ? 1 : 0,

            name: key,

            data: []

          };

          if (isDeviationRule) {

            seriesMap[key]["zIndex"] = 10;

            seriesMap[key]["tooltip"] = {

              valueSuffix: " %"

            };

          }

        }

        if (hit.value.hasOwnProperty(key)) {

          seriesMap[key].data.push({

            x: hit.tmst,

            y: +parseFloat(hit.value[key]).toFixed(2),

            sortBy: getSortBy(hit.value)

          });

        }

      });

    }

  });

  chart.series = Object.keys(seriesMap)

    .filter(key => seriesMap[key].data.length)

    .map(key => seriesMap[key]);



  return chart

};

getSortBy = (agg)=> {

  const keys = Object.keys(agg);

  let sortBy;

  const metrics = ["deviation_dow", "deviation", "ratio"];

  metrics.some(i => {

    if (keys.some(j => j.endsWith(i))) {

      sortBy = i;

      return true;

    } else {

      return false;

    }

  });

  return sortBy;

}

formatter = (chart, metric) => {

  function formatFn() {

    const minute = moment.utc(this.value).minutes();

    const hour = moment.utc(this.value).hour();

    let format;

    if (!hour && !minute) {

      format = " DD MMM";

    } else {

      if (this.isFirst && this.isLast) {

        format = " DD MMM HH:mm";

      } else {

        format = " HH:mm";

      }

    }

    return moment(this.value)

      .utc()

      .format(format);

  }

  chart.xAxis = {

    categories: [],

    crosshair: true,

    labels: {

      formatter: formatFn

    }

  };

  chart.navigator = {

    xAxis: {

      labels: {

        formatter: formatFn

      }

    }

  };

}

isNullOrUndefined = (val) =>{
  return (val === undefined || val === null)
}

getProfilingJson = (req) =>{



  var res = profilingResponse(req.metric,req.aggValue);
  return res;
}

profilingResponse = (data, aggregatorKey) => {

  const buckets = data.aggregations;
 

  const req =  {

      name: _.get(buckets, ["asMap","tophit", "hits", "hits", "0", "source", "name"], "NA"),
      
      hits: !isNullOrUndefined(aggregatorKey)

        ? buckets.asMap.agg_rule_values.buckets.map(hits => {

            const tmp = {

              tmst: hits.key,

              value: hits.aggregations.asMap.metric_agg.aggregations.asMap.rule_names.buckets.map(hit => {
               const temp =  _.get(

                  hit,

                  [
                    "aggregations",
                    "asMap",
                    "agg_list",
                    "aggregations",
                    "asMap",

                    "aggregator_key_list",

                    "buckets",
                    
                    "0",
                    "aggregations",
                    "asMap",

                    "rule_value",

                    "buckets",
                    
                    "0",

                    "key"

                  ],

                  0

                )

                const temp1 = {

                  [hit.key]: temp,

                  ...[

                    "deviation",

                   "deviation_dow",

                    "ratio",

                    "average",

                    "dow_average",

                    "ratio_average"

                  ].reduce(function(acc, cur) {

                    acc[hit.key + "_" + cur] = _.get(

                      hit,

                      [
                        "aggregations",
                      "asMap",
                        "agg_list",
                         "aggregations",

                      "asMap",
                       "aggregator_key_list",
                        "buckets",
                        "0",
                         "aggregations",

                      "asMap",
                        cur,
                         "value"],

                      undefined

                    );

                    return acc;

                  }, {})

                };
                return temp1

              })[0]

            };

            return tmp

          })

        : buckets.asMap.basic_rule_values.hits.hits.map(hit => hit.source),

      args: buckets.asMap.tophit.hits.hits.map(hit => hit.source.sinkArgs)

    }


  return profilingChartOption(req)

};

getContributorsJson = (req) => {
  var constributorJson = {
    credits: {

      enabled: false

    },
    chart: {
        type: 'bar',
        width: 1000
    },
    colors: CHART_COLORS,
    title: {
        text: 'Title of the Chart'
    },
    xAxis: {
        categories: [],
        labels: {
          rotation:0
        },
        title: {
          text: 'X axis'
      }
    },
    yAxis: {
        min: 0,
        title: {
            text: 'Y axis'
        }
    },
    legend: {
        reversed: true
    },
    plotOptions: {
        series: {
            stacking: 'normal',
            color:'#e20074',
            dataLabels: {
              enabled: true,
              color: 'black',
              style: {fontWeight: 'bolder'},
              
            format:'{point.label}',
              inside: false,
              crop:false,
              overflow : 'allow'
          }
                    
        }
    },
    series: [{
    }]
}

value = req.body.data;
constributorJson.xAxis.categories=value.map(i => {

  return i[req.body.metadata.xtitle];
});

stacks = req.body.metadata.stacks
constributorJson.series=stacks.map(i => {

  return {
    name:i,
    data: value.map(j => {
      return {
        y:j[i],
        label:j[req.body.metadata.xbarLabelColumn]
      };
    })

  };
});
constributorJson.yAxis.title.text=req.body.metadata.ytitle
constributorJson.xAxis.title.text=req.body.metadata.xtitle
constributorJson.title.text=req.body.metadata.chartTitle

return constributorJson;

};

