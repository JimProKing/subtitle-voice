FROM node:20-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip libgomp1 libglib2.0-0 libgl1 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY requirements-ocr.txt ocr_worker.py ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements-ocr.txt \
  && python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='korean', use_angle_cls=False, show_log=False, use_gpu=False)"
COPY . .
ENV NODE_ENV=production
ENV APP_VERSION=16
EXPOSE 3000
CMD ["node", "server.js"]
