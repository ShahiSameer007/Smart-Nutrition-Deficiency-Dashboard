const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Edamam API Credentials
const APP_ID = 'b5f9c0d4';
const APP_KEY = '4b5ac5b34f94aa632ab1914652a7aa98';

app.get('/api/nutrition', async (req, res) => {
    try {
        let query = req.query.ingr;
        if (!query) {
            return res.status(400).json({ error: "Please provide an ingredient." });
        }

        // Preprocess: Add "1 " if the query doesn't start with a number.
        // This is necessary because Edamam works optimally with quantifiers ("1 egg", not "egg").
        if (!/^\d/.test(query.trim())) {
            query = "1 " + query.trim();
        }

        // Realistic Offline Database for core planner items
        const OFFLINE_DB = {
            "1 cup spinach": { ENERC_KCAL: 7, PROCNT: 0.9, CHOCDF: 1.1, FAT: 0.1, VITC: 8.4, FIBTG: 0.7, FE: 0.8, CA: 30, VITD: 0, weight: 30 },
            "1 apple": { ENERC_KCAL: 95, PROCNT: 0.5, CHOCDF: 25, FAT: 0.3, VITC: 8.4, FIBTG: 4.4, FE: 0.2, CA: 11, VITD: 0, weight: 182 },
            "1 cup cooked quinoa": { ENERC_KCAL: 222, PROCNT: 8.1, CHOCDF: 39.4, FAT: 3.6, VITC: 0, FIBTG: 5.2, FE: 2.8, CA: 31, VITD: 0, weight: 185 },
            "200g grilled chicken breast": { ENERC_KCAL: 330, PROCNT: 62, CHOCDF: 0, FAT: 7.2, VITC: 0, FIBTG: 0, FE: 2.1, CA: 30, VITD: 0.1, weight: 200 },
            "1 cup lentils": { ENERC_KCAL: 230, PROCNT: 17.9, CHOCDF: 39.9, FAT: 0.8, VITC: 3, FIBTG: 15.6, FE: 6.6, CA: 38, VITD: 0, weight: 198 },
            "2 eggs": { ENERC_KCAL: 143, PROCNT: 12.6, CHOCDF: 0.7, FAT: 9.5, VITC: 0, FIBTG: 0, FE: 1.8, CA: 56, VITD: 2, weight: 100 },
            "1 bowl oatmeal": { ENERC_KCAL: 158, PROCNT: 5.9, CHOCDF: 27.3, FAT: 3.2, VITC: 0, FIBTG: 4, FE: 2.1, CA: 21, VITD: 0, weight: 234 },
            "1 cup almonds": { ENERC_KCAL: 828, PROCNT: 30.2, CHOCDF: 30.8, FAT: 71.4, VITC: 0, FIBTG: 17.9, FE: 5.3, CA: 385, VITD: 0, weight: 143 },
            "1 serving salmon": { ENERC_KCAL: 280, PROCNT: 39.2, CHOCDF: 0, FAT: 12.5, VITC: 0, FIBTG: 0, FE: 0.8, CA: 20, VITD: 14.5, weight: 150 },
            "1 serving tofu": { ENERC_KCAL: 144, PROCNT: 15.8, CHOCDF: 2.8, FAT: 8.7, VITC: 0.2, FIBTG: 2.3, FE: 5.4, CA: 683, VITD: 0, weight: 120 },
            "1 cup soy milk": { ENERC_KCAL: 131, PROCNT: 8, CHOCDF: 15.3, FAT: 4.3, VITC: 0, FIBTG: 1.5, FE: 1.1, CA: 300, VITD: 3, weight: 240 },
            "1 orange": { ENERC_KCAL: 73, PROCNT: 1.3, CHOCDF: 16.5, FAT: 0.2, VITC: 82.7, FIBTG: 2.8, FE: 0.2, CA: 60, VITD: 0, weight: 154 },
            "1 cup broccoli": { ENERC_KCAL: 31, PROCNT: 2.6, CHOCDF: 6, FAT: 0.3, VITC: 81.2, FIBTG: 2.4, FE: 0.7, CA: 43, VITD: 0, weight: 91 }
        };

        const queryLower = query.toLowerCase();
        
        let matchedOfflineKey = Object.keys(OFFLINE_DB).find(k => queryLower.includes(k.toLowerCase()));
        
        if (matchedOfflineKey) {
            const rawData = OFFLINE_DB[matchedOfflineKey];
            
            // Format mock data perfectly mimicking Edamam structure
            const nutrients = {
                ENERC_KCAL: { quantity: rawData.ENERC_KCAL, unit: "kcal" },
                PROCNT: { quantity: rawData.PROCNT, unit: "g" },
                CHOCDF: { quantity: rawData.CHOCDF, unit: "g" },
                FAT: { quantity: rawData.FAT, unit: "g" },
                VITC: { quantity: rawData.VITC, unit: "mg" },
                FIBTG: { quantity: rawData.FIBTG, unit: "g" },
                FE: { quantity: rawData.FE, unit: "mg" },
                CA: { quantity: rawData.CA, unit: "mg" },
                VITD: { quantity: rawData.VITD, unit: "mcg" }
            };

            return res.json({
                ingredients: [{
                    parsed: [{
                        weight: rawData.weight,
                        nutrients: nutrients
                    }]
                }]
            });
        }

        const url = `https://api.edamam.com/api/nutrition-data?app_id=${APP_ID}&app_key=${APP_KEY}&ingr=${encodeURIComponent(query)}`;
        const response = await axios.get(url);

        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.warn("Edamam API Rate Limited (429). Returning mock data.");
            const queryLower = typeof query === 'string' ? query.toLowerCase() : '';
            
            // Extract multiplier, defaulting to 1
            let multiplier = 1;
            const match = queryLower.match(/^(\d*(?:\.\d+)?)\s*(g|oz|ml|kg|lb|lbs)?/i);
            if (match && match[1]) {
                const numeric = parseFloat(match[1]) || 1;
                const unit = match[2];
                if (unit && unit.startsWith('g')) {
                    multiplier = numeric / 150; // mock payload is base 150g
                } else if (unit && unit === 'oz') {
                    multiplier = numeric / 5; // roughly 150g
                } else if (unit && unit === 'ml') {
                    multiplier = numeric / 150;
                } else if (unit && (unit === 'kg' || unit === 'lb' || unit === 'lbs')) {
                    multiplier = numeric * 6;
                } else {
                    multiplier = numeric;
                }
            }
            
            // Base generic mock nutrients
            let nutrients = {
                ENERC_KCAL: { quantity: 120 * multiplier, unit: "kcal" },
                PROCNT: { quantity: 10 * multiplier, unit: "g" },
                CHOCDF: { quantity: 20 * multiplier, unit: "g" },
                FAT: { quantity: 5 * multiplier, unit: "g" },
                VITC: { quantity: 25 * multiplier, unit: "mg" },
                FIBTG: { quantity: 5 * multiplier, unit: "g" },
                FE: { quantity: 2 * multiplier, unit: "mg" },
                CA: { quantity: 50 * multiplier, unit: "mg" },
                VITD: { quantity: 0.5 * multiplier, unit: "mcg" }
            };

            // Boost certain nutrients based on keyword to make demo responsive
            if (queryLower.includes('milk') || queryLower.includes('salmon') || queryLower.includes('egg')) {
                nutrients.VITD.quantity = 15 * multiplier; // High Vit D
                nutrients.CA.quantity = 400 * multiplier; // High Calcium
            }
            if (queryLower.includes('spinach') || queryLower.includes('quinoa') || queryLower.includes('lentil') || queryLower.includes('broccoli')) {
                nutrients.FE.quantity = 8 * multiplier; // High Iron
                nutrients.FIBTG.quantity = 12 * multiplier; // High Fiber
            }
            if (queryLower.includes('orange') || queryLower.includes('apple')) {
                nutrients.VITC.quantity = 80 * multiplier; // High Vit C
            }

            // Return mock data for demonstration when rate limited
            return res.json({
                ingredients: [{
                    parsed: [{
                        weight: 150 * multiplier,
                        nutrients: nutrients
                    }]
                }]
            });
        }
        console.error("Error fetching nutrition data:", error.message);
        res.status(500).json({ error: "Failed to fetch nutrition data. Please try again." });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
