FROM node:slim

ENV ACCEPT_HIGHCHARTS_LICENSE=1

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y git curl bzip2 fontconfig \
    && mkdir -p /opt/highcharts-export-server \
    && cd /opt/highcharts-export-server \
    && git clone -b Feature-186 https://github.com/enqueroinc/node-export-server.git ./ \
    && npm install \
    && npm link \
    && node build.js

EXPOSE 7801

WORKDIR /opt/highcharts-export-server

ENTRYPOINT [ "highcharts-export-server", "-enableServer", "1" ]
