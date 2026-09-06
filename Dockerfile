FROM node:22-alpine

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev --ignore-scripts

COPY backend/src ./src
COPY backend/import ./import
COPY backend/storage ./storage
COPY frontend /app/frontend

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
