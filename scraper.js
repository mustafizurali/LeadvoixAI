/**
 * LeadVoixAI Free Lead Scraper
 * 
 * Scrapes Google Maps real estate agent business profiles (Name, Phone, Rating, Website) 
 * for a target search query and saves the leads into a CSV file.
 * 
 * Dependencies to install before running:
 * npm install puppeteer csv-writer
 * 
 * Run using:
 * node scraper.js "real estate agents in Miami"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const query = process.argv[2] || "real estate agents in Miami Beach";
console.log(`Starting scraper for search term: "${query}"...`);

async function scrapeGoogleMaps() {
    // Launch headless browser
    const browser = await puppeteer.launch({
        headless: false, // Set to true to run in background
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Format query for URL
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("Searching Google Maps... Scrolling sidebar to load more leads...");

    // Selector for the sidebar container list on Google Maps
    const sidebarSelector = 'div[role="feed"]';
    
    try {
        await page.waitForSelector(sidebarSelector, { timeout: 10000 });
    } catch (e) {
        console.log("Could not find list sidebar. Google Maps might have changed layout, trying fallback scroll...");
    }

    // Scroll script to load more results (approx 60-80 listings)
    let listingsCount = 0;
    for (let i = 0; i < 15; i++) {
        await page.evaluate((selector) => {
            const sidebar = document.querySelector(selector) || document.querySelector('div[jsaction*="pane.wf.scroll"]');
            if (sidebar) {
                sidebar.scrollTop = sidebar.scrollHeight;
            } else {
                window.scrollBy(0, 1000);
            }
        }, sidebarSelector);
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // sleep 2s
        console.log(`Scroll iteration ${i + 1}/15...`);
    }

    // Extract list data
    const leads = await page.evaluate(() => {
        const results = [];
        // Google Maps card selector
        const cards = document.querySelectorAll('a[href*="/maps/place/"]');
        
        cards.forEach(card => {
            try {
                const parent = card.parentElement;
                if (!parent) return;

                // Extract Business Name
                const nameNode = parent.querySelector('div.fontHeadlineSmall') || parent.querySelector('.qBF1Pd');
                const name = nameNode ? nameNode.textContent.trim() : '';

                if (!name) return;

                // Extract Rating & Review Count
                const ratingNode = parent.querySelector('span.MW4etd');
                const rating = ratingNode ? parseFloat(ratingNode.textContent.trim()) : 'No Rating';

                const reviewsNode = parent.querySelector('span.UY7F9');
                const reviews = reviewsNode ? reviewsNode.textContent.replace(/[()]/g, '').trim() : '0';

                // Extract Phone & Website links
                // These are usually in secondary text lines
                const textLines = parent.querySelectorAll('div.W4E3ce');
                let phone = 'Not Found';
                let address = 'Not Found';

                // Locate elements containing website URLs
                const websiteLinkNode = parent.querySelector('a[aria-label*="website"]') || parent.querySelector('a[aria-label*="Website"]');
                const website = websiteLinkNode ? websiteLinkNode.href : 'Not Found';

                // Look inside children text nodes to extract phone numbers (e.g. starting with +1 or containing digits)
                const allTexts = Array.from(parent.querySelectorAll('span, div')).map(el => el.textContent.trim());
                const phoneRegex = /(\+?\d{1,4}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/; // matches US phone formats
                
                for (const txt of allTexts) {
                    if (phoneRegex.test(txt) && !txt.includes('Open') && !txt.includes('Closed')) {
                        // Clean matching phone text
                        const match = txt.match(phoneRegex);
                        if (match) {
                            phone = match[0];
                            break;
                        }
                    }
                }

                results.push({
                    name,
                    rating,
                    reviews,
                    phone,
                    website
                });
            } catch (err) {
                // Ignore parsing errors for single card
            }
        });

        // De-duplicate leads by name
        const uniqueResults = [];
        const seenNames = new Set();
        for (const item of results) {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                uniqueResults.push(item);
            }
        }

        return uniqueResults;
    });

    console.log(`Scraped ${leads.length} unique real estate agents.`);

    // Close the browser
    await browser.close();

    // Export to CSV
    if (leads.length > 0) {
        const csvPath = path.join(__dirname, 'leads.csv');
        const csvWriter = createCsvWriter({
            path: csvPath,
            header: [
                { id: 'name', title: 'BUSINESS_NAME' },
                { id: 'rating', title: 'RATING' },
                { id: 'reviews', title: 'REVIEWS' },
                { id: 'phone', title: 'PHONE' },
                { id: 'website', title: 'WEBSITE' }
            ]
        });

        await csvWriter.writeRecords(leads);
        console.log(`Successfully saved leads to: ${csvPath}`);
    } else {
        console.log("No leads were extracted. Check search query or element selectors.");
    }
}

scrapeGoogleMaps().catch(err => {
    console.error("An error occurred during scraping:", err);
});
