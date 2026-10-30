FROM node:24-slim AS dependencies

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

FROM node:22-bookworm AS deploy

RUN apt-get update && \
    apt-get install -y unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -L -o aws-sam.zip https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip && \
    unzip aws-sam.zip -d /tmp/aws-sam && \
    rm aws-sam.zip && \
    /tmp/aws-sam/install && \
    sam --version

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production
COPY lambda ./lambda
COPY deploy.sh ./

CMD ["./deploy.sh"]

FROM node:24-slim AS production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json index.js common.js ./
COPY addon ./addon

CMD ["node", "index.js"]
