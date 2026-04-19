const NUTRIENTS_DEF = [
    { code: 'PROCNT', name: 'Protein', suggest: 'Chicken, lentils, tofu, Greek yogurt, beef, beans', dv: 50 },
    { code: 'CHOCDF', name: 'Carbs', suggest: 'Brown rice, sweet potatoes, oats, quinoa, bananas', dv: 275 },
    { code: 'FAT', name: 'Fats', suggest: 'Avocado, nuts, olive oil, salmon, seeds', dv: 78 },
    { code: 'FIBTG', name: 'Fiber', suggest: 'Broccoli, whole grains, chia seeds, berries', dv: 28 },
    { code: 'FE', name: 'Iron', suggest: 'Spinach, red meat, lentils, pumpkin seeds, quinoa', dv: 18 },
    { code: 'CA', name: 'Calcium', suggest: 'Milk, cheese, leafy greens, fortified plant milk, almonds', dv: 1300 },
    { code: 'VITC', name: 'Vitamin C', suggest: 'Oranges, strawberries, bell peppers, kiwi, broccoli', dv: 90 },
    { code: 'VITD', name: 'Vitamin D', suggest: 'Sunlight exposure, salmon, egg yolks, mushrooms', dv: 20 }
];


let userProfile = {
    age: 25,
    gender: 'male',
    weight: 70, // kg
    height: 175, // cm
    activeBaseProfile: false
};

const THRESHOLD = 10; // 10% Daily Value threshold for determining if a nutrient is "missing" in this context

// Global State
let currentFoodData = null;
let currentFoodQuery = "";
let weeklyPlan = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
};
let weeklyNutrientsAggregated = {};

// DOM Elements
const searchBtn = document.getElementById('searchBtn');
const foodInput = document.getElementById('foodInput');
const headerStatus = document.getElementById('headerStatus');
const foodSummary = document.getElementById('foodSummary');
const presentGrid = document.getElementById('presentGrid');
const missingGrid = document.getElementById('missingGrid');
const addToPlanBtn = document.getElementById('addToPlanBtn');
const daySelect = document.getElementById('daySelect');

// New DOM Elements
const filterBtn = document.getElementById('filterBtn');
const filterDropdown = document.getElementById('filterDropdown');
const filterResults = document.getElementById('filterResults');
const autoSetPlanBtn = document.getElementById('autoSetPlanBtn');
const autoPlanDaySelect = document.getElementById('autoPlanDaySelect');
const autoPlanPrefSelect = document.getElementById('autoPlanPrefSelect');
const saveProfileBtn = document.getElementById('saveProfileBtn');

// Event Listeners
searchBtn.addEventListener('click', analyzeFood);
foodInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeFood();
});

addToPlanBtn.addEventListener('click', () => {
    if (!currentFoodData) return;
    const day = daySelect.value;
    
    const daysToAdd = day === 'Entire Week' ? Object.keys(weeklyPlan) : [day];
    
    daysToAdd.forEach(d => {
        weeklyPlan[d].push({
            name: currentFoodQuery,
            data: currentFoodData
        });
    });

    alert(`Successfully added ${currentFoodQuery} to ${day}'s plan!`);
    renderPlanner();
});

// Tab Switching
window.switchTab = function(tabId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(tabId + 'Section').classList.add('active');
    
    if(tabId === 'planner') {
        renderPlanner();
    }
}

// Profile Logic
saveProfileBtn.addEventListener('click', () => {
    userProfile.age = parseInt(document.getElementById('profileAge').value) || 25;
    userProfile.weight = parseInt(document.getElementById('profileWeight').value) || 70;
    userProfile.height = parseInt(document.getElementById('profileHeight').value) || 175;
    userProfile.gender = document.getElementById('profileGender').value;
    userProfile.activeBaseProfile = true;

    // Calculate BMR (Mifflin-St Jeor)
    let bmr = (10 * userProfile.weight) + (6.25 * userProfile.height) - (5 * userProfile.age);
    bmr += (userProfile.gender === 'male') ? 5 : -161;
    
    // Update DVs based on weight (e.g. Protein 1.2g/kg instead of flat 50g)
    NUTRIENTS_DEF.find(n => n.code === 'PROCNT').dv = Math.round(userProfile.weight * 1.2);

    document.getElementById('bmrResult').style.display = 'block';
    document.getElementById('bmrText').innerHTML = `Your Base Metabolic Rate is approx. <strong>${Math.round(bmr)} kcal/day</strong>.<br>Protein target Daily Value automatically tailored to <strong>${Math.round(userProfile.weight * 1.2)}g</strong>.`;
    document.getElementById('sidebarUserName').textContent = `${userProfile.age}y ${userProfile.gender === 'male' ? 'M' : 'F'}, ${userProfile.weight}kg`;
    
    alert("Profile saved! Daily Values customized based on your body.");
});

// Browse/Filter Logic
filterBtn.addEventListener('click', () => {
    filterDropdown.style.display = filterDropdown.style.display === 'none' ? 'block' : 'none';
    filterResults.style.display = 'none';
});

window.fetchMockFoods = function(category) {
    const list = FOOD_DB.filter(f => f.tags.includes(category));
    filterDropdown.style.display = 'none';
    
    if (list.length === 0) {
        filterResults.innerHTML = '<div style="padding: 1rem; color: var(--text-muted)">No foods found for this category.</div>';
    } else {
        filterResults.innerHTML = list.map(item => `
            <div class="mock-food-item" onclick="selectMockFood('${item.name}')">
                <span class="mock-food-name">${item.name}</span>
                <span class="mock-food-tags">${item.tags.join(', ')}</span>
            </div>
        `).join('');
    }
    filterResults.style.display = 'block';
};

window.selectMockFood = function(foodName) {
    foodInput.value = foodName;
    filterResults.style.display = 'none';
    analyzeFood();
};

// Auto Set Planner Logic
autoSetPlanBtn.addEventListener('click', async () => {
    const pref = autoPlanPrefSelect.value;
    const dayOption = autoPlanDaySelect.value;
    
    let candidateFoods = FOOD_DB;
    if (pref !== 'standard') {
        candidateFoods = FOOD_DB.filter(f => f.tags.includes(pref));
        if(candidateFoods.length === 0) candidateFoods = FOOD_DB; // fallback if list is too restricted
    }

    const daysToFill = dayOption === 'Entire Week' ? Object.keys(weeklyPlan) : [dayOption];
    
    autoSetPlanBtn.disabled = true;
    autoSetPlanBtn.textContent = "Generating...";

    for (const day of daysToFill) {
        // Clear previous plan for the day when auto-setting
        weeklyPlan[day] = [];
        
        // Pick random items to fill the day
        const shuffled = [...candidateFoods].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(2, shuffled.length));
        
        for (const food of selected) {
            try {
                // Fetch real API data to populate tracking
                const data = await fetchNutritionData(food.name);
                if (data && !data.error && data.ingredients && data.ingredients[0]) {
                    weeklyPlan[day].push({ name: food.name + " (Auto)", data: data });
                }
                // Avoid rate-limiting by waiting briefly
                await new Promise(r => setTimeout(r, 250));
            } catch(e) {
                console.error(e);
            }
        }
    }
    
    autoSetPlanBtn.disabled = false;
    autoSetPlanBtn.textContent = "Auto Set Plan according to Recommendation";
    alert(`Successfully Auto-filled ${dayOption} based on ${pref} profile preference!`);
    renderPlanner();
});


// API Analysis
const apiCache = {};

async function fetchNutritionData(query) {
    if (apiCache[query]) {
        return JSON.parse(JSON.stringify(apiCache[query]));
    }

    const response = await fetch(`/api/nutrition?ingr=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (data.error) throw new Error(data.error);
    
    if (!data.ingredients || !data.ingredients[0] || !data.ingredients[0].parsed || !data.ingredients[0].parsed[0]) {
        throw new Error("Could not find nutritional data for this item. Please try formatting differently (e.g., '1 cup rice').");
    }

    // Cache the successful baseline response
    apiCache[query] = JSON.parse(JSON.stringify(data));
    
    return JSON.parse(JSON.stringify(data));
}

async function analyzeFood() {
    const query = foodInput.value.trim();
    if (!query) return;

    currentFoodQuery = query;
    headerStatus.textContent = 'Analyzing...';
    searchBtn.disabled = true;

    try {
        const data = await fetchNutritionData(query);

        currentFoodData = data;
        renderDashboard(data);
        
        headerStatus.textContent = `Successfully Analyzed: ${query}`;
        addToPlanBtn.disabled = false;
        
    } catch (error) {
        alert(error.message);
        headerStatus.textContent = 'Error during analysis.';
        currentFoodData = null;
        addToPlanBtn.disabled = true;
    } finally {
        searchBtn.disabled = false;
    }
}

// Rendering Dashboards
function renderDashboard(data) {
    const parsedData = data.ingredients[0].parsed[0];
    const nutrientsObj = parsedData.nutrients || {};
    
    const calObj = nutrientsObj['ENERC_KCAL'];
    const cal = calObj ? Math.round(calObj.quantity) : 0;
    const weight = Math.round(parsedData.weight || 0);
    
    foodSummary.innerHTML = `
        <p>You searched for: <strong>${currentFoodQuery}</strong></p>
        <div class="macros">
            <div class="macro-item">Calories <span class="macro-value">${cal} kcal</span></div>
            <div class="macro-item">Total Weight <span class="macro-value">${weight} g</span></div>
        </div>
    `;

    presentGrid.innerHTML = '';
    missingGrid.innerHTML = '';
    
    let presentCount = 0;
    let missingCount = 0;

    NUTRIENTS_DEF.forEach(nutInfo => {
        const absData = nutrientsObj[nutInfo.code];
        
        let percentDV = 0;
        let absVal = '0g';

        if (absData) {
            // Calculate % DV manually: (Amount / DV limit) * 100
            percentDV = Math.round((absData.quantity / nutInfo.dv) * 100);
            
            // Format to 1 decimal if small, else round
            let qty = absData.quantity < 10 ? absData.quantity.toFixed(1) : Math.round(absData.quantity);
            absVal = `${qty}${absData.unit}`;
        }

        if (percentDV >= THRESHOLD) {
            // Nutrient is present above threshold
            presentGrid.innerHTML += `
                <div class="nutrient-box">
                    <span class="nutrient-name">${nutInfo.name}</span>
                    <span class="nutrient-value">${absVal} (${percentDV}% DV)</span>
                </div>
            `;
            presentCount++;
        } else {
            // Nutrient is missing/below threshold
            missingGrid.innerHTML += `
                <div class="nutrient-box missing">
                    <div class="nutrient-header">
                        <span class="nutrient-name">${nutInfo.name}</span>
                        <span class="nutrient-value">${absVal} (${percentDV}% DV)</span>
                    </div>
                    <div class="suggestions">
                        Missing! Get it from: <span>${nutInfo.suggest}</span>
                    </div>
                </div>
            `;
            missingCount++;
        }
    });

    if (presentCount === 0) {
        presentGrid.innerHTML = '<p class="placeholder-text">No significant amount of core nutrients found in this item.</p>';
    }
    if (missingCount === 0) {
        missingGrid.innerHTML = '<p class="placeholder-text">Wow! This is remarkably nutritious. No core nutrients are severely lacking.</p>';
    }
}

// Rendering Planner
function renderPlanner() {
    const grid = document.querySelector('.weekly-grid');
    grid.innerHTML = '';
    
    // Reset aggregate counters
    weeklyNutrientsAggregated = {};
    NUTRIENTS_DEF.forEach(n => weeklyNutrientsAggregated[n.code] = 0);
    let totalWeeklyCalories = 0;

    // Render individual days
    Object.keys(weeklyPlan).forEach(day => {
        const items = weeklyPlan[day];
        let itemsHtml = items.map((i, index) => `
            <li class="planner-item">
                <span>${i.name}</span>
                <button class="remove-btn" onclick="removeFoodFromPlan('${day}', ${index})" aria-label="Remove ${i.name}">×</button>
            </li>`).join('');
        if (!itemsHtml) itemsHtml = '<li class="placeholder-text" style="color:var(--text-muted)">Rest Day / No entries</li>';
        
        grid.innerHTML += `
            <div class="day-card">
                <h4>${day}</h4>
                <ul>${itemsHtml}</ul>
            </div>
        `;

        // Accumulate nutrients
        items.forEach(item => {
            const parsedData = item.data.ingredients[0].parsed[0];
            const nutrientsObj = parsedData.nutrients || {};
            
            if (nutrientsObj['ENERC_KCAL']) {
                totalWeeklyCalories += nutrientsObj['ENERC_KCAL'].quantity;
            }

            NUTRIENTS_DEF.forEach(n => {
                const absData = nutrientsObj[n.code];
                if (absData) {
                    const percentDV = (absData.quantity / n.dv) * 100;
                    weeklyNutrientsAggregated[n.code] += percentDV;
                }
            });
        });
    });

    // Render Weekly Assessment
    const assessment = document.getElementById('weeklyAssessment');
    let assessmentHtml = '<div style="display:flex; flex-wrap:wrap; gap: 1rem;">';
    
    const isCalActive = totalWeeklyCalories > 0;
    assessmentHtml += `
        <div style="background: rgba(0,0,0,0.2); padding: 0.8rem 1rem; border-radius: 8px; border-left: 3px solid ${isCalActive ? '#8b5cf6' : 'var(--text-muted)'}">
            <div style="font-size:0.9rem; color:var(--text-muted)">Total Calories</div>
            <div style="font-size:1.1rem; font-weight:600; color:var(--text-main)">${Math.round(totalWeeklyCalories)} kcal</div>
        </div>
    `;
    
    NUTRIENTS_DEF.forEach(n => {
        const totalDV = Math.round(weeklyNutrientsAggregated[n.code]);
        // Simple metric: are they hitting at least 100% DV cumulatively across planned meals?
        const isGood = totalDV >= 100;
        
        assessmentHtml += `
            <div style="background: rgba(0,0,0,0.2); padding: 0.8rem 1rem; border-radius: 8px; border-left: 3px solid ${isGood ? 'var(--accent-green)' : 'var(--accent-red)'}">
                <div style="font-size:0.9rem; color:var(--text-muted)">${n.name}</div>
                <div style="font-size:1.1rem; font-weight:600; color:var(--text-main)">${totalDV}%</div>
            </div>
        `;
    });
    
    assessmentHtml += '</div><p style="margin-top:1.5rem; font-size:0.9rem; color:var(--text-muted)">Values represent cumulative % Daily Value across your planned meals. Aim to exceed 100% per day, or roughly 700% for a full week.</p>';
    
    assessment.innerHTML = assessmentHtml;
}

window.removeFoodFromPlan = function(day, index) {
    if (weeklyPlan[day] && weeklyPlan[day][index]) {
        weeklyPlan[day].splice(index, 1);
        renderPlanner();
    }
};

// Initial render for empty planner
renderPlanner();
