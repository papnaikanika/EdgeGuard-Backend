FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

COPY . .

ENV PYTHON_PATH=/usr/bin/python3

EXPOSE 3000

CMD ["node", "server.js"]
