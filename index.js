require('dotenv').config();

const Parser = require('rss-parser');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

// Environment variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID in environment variables.');
  process.exit(1);
}

// Initialize Telegram bot (no polling, only sending messages)
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// RSS feed list (extendable)
// 연합뉴스 경제 RSS (한국어 뉴스)
const RSS_FEEDS = [
  'https://www.yna.co.kr/rss/economy.xml'
];

// Keyword list for filtering news
const KEYWORDS = ['금리', 'CPI', '반도체', 'AI', 'HBF'];
const NORMALIZED_KEYWORDS = KEYWORDS.map((k) => k.toLowerCase());

// In-memory set to track already-sent news (by link)
const sentLinks = new Set();

async function fetchFeedItems(feedUrl) {
  const parser = new Parser();
  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items || [];
  } catch (error) {
    console.error(`Failed to fetch or parse RSS feed: ${feedUrl}`);
    console.error(error.message || error);
    return [];
  }
}

async function sendTelegramMessage(title, link) {
  const messageLines = [
    '경제 뉴스 알림',
    '',
    `[${title || '제목 없음'}]`,
    '',
    `[${link || ''}]`
  ];

  const message = messageLines.join('\n');

  try {
    await bot.sendMessage(TELEGRAM_CHAT_ID, message, {
      disable_web_page_preview: false
    });
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message || error);
  }
}

async function run() {
  console.log('Starting economic news alert bot...');

  for (const feedUrl of RSS_FEEDS) {
    console.log(`Fetching RSS feed: ${feedUrl}`);

    const items = await fetchFeedItems(feedUrl);
    console.log(`Fetched ${items.length} items from feed.`);

    for (const item of items) {
      const title = item.title || '제목 없음';
      const link = item.link || '';
      const normalizedTitle = title.toLowerCase();

      const hasKeyword = NORMALIZED_KEYWORDS.some((keyword) =>
        normalizedTitle.includes(keyword)
      );

      if (!hasKeyword) {
        continue;
      }

      // Prevent duplicate alerts for the same link within this process
      if (link && sentLinks.has(link)) {
        console.log(`Skipping duplicate alert for: ${title}`);
        continue;
      }

      await sendTelegramMessage(title, link);
      if (link) {
        sentLinks.add(link);
      }
      console.log(`Sent alert for (matched keyword): ${title}`);
    }
  }

  console.log('Done sending economic news alerts.');
}

// Additional economic news fetching logic (prints title and link)
const ECONOMIC_NEWS_RSS_URL = 'https://www.yna.co.kr/rss/economy.xml';

async function fetchAndPrintEconomicNews() {
  const parser = new Parser();

  try {
    console.log(`\nFetching economic news from: ${ECONOMIC_NEWS_RSS_URL}`);
    const feed = await parser.parseURL(ECONOMIC_NEWS_RSS_URL);
    const items = feed.items || [];

    console.log(`Fetched ${items.length} economic news articles.\n`);

    for (const item of items) {
      const title = item.title || '제목 없음';
      const link = item.link || '';

      console.log('제목:', title);
      console.log('링크:', link);
      console.log('-----------------------------');
    }
  } catch (error) {
    console.error('Failed to fetch or parse economic news RSS feed.');
    console.error(error.message || error);
  }
}

// Schedule: run every day at 11:00 (Asia/Seoul)
cron.schedule(
  '0 11 * * *',
  () => {
    console.log('\n[Scheduler] Running economic news tasks (every day at 11:00)');
    run().catch((error) => {
      console.error('Unexpected error in bot execution:', error.message || error);
    });
    fetchAndPrintEconomicNews().catch((error) => {
      console.error('Unexpected error in fetchAndPrintEconomicNews:', error.message || error);
    });
  },
  {
    timezone: 'Asia/Seoul'
  }
);

console.log('Scheduler initialized: will run every day at 11:00 (Asia/Seoul time).');

