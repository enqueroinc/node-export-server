const moment = require('moment');
const _ = require('lodash');
const CHART_COLORS = [
  "#223c61",
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
  }
}
var anomaly = {};
getDashboardJson = (req) => {
  value = req.body.data
  anomaly = req.body.anomaly
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

          if (value > 1000000) {

            result = Math.floor(value / 1000000000) + "B";

          } else if (value > 1000) {

            result = Math.floor(value / 1000000) + "M";

          } else if (value > 1000) {

            result = Math.floor(value / 1000) + "k";

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

      x: moment(rec[field], "YYYY-MM-DD").valueOf(),

      name: moment(rec[field], "YYYY-MM-DD").format("YYYY-MM-DD"),

      y: +rec[name].toFixed(2)

    };



    if (name !== "expected_upper_limit" && name !== "expected_lower_limit" && rec.anomaly_flag) {

      obj.color = "red";

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

      name: moment(rec[field], "YYYY-MM-DD").format("YYYY-MM-DD"),

      x: moment(rec[field], "YYYY-MM-DD").valueOf(),

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

        // Primary yAxis

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

getContributorsJson = (req) => {
  var constributorJson = {
    credits: {

      enabled: false

    },
    chart: {
        type: 'column',
        width: 800
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
            dataLabels: {
              enabled: true,
              color: 'white',
              style: {fontWeight: 'bolder'},
              
            format:'{point.label}',
              inside: true,
              rotation: 270
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