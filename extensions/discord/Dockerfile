FROM node:18-buster

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .
RUN yarn

CMD ["yarn", "dev"]
