FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /tests

COPY package.json ./
RUN npm install

COPY playwright.config.ts ./
COPY tests/ tests/

RUN mkdir -p screenshots test-results

CMD ["npx", "playwright", "test"]
