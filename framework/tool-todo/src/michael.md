---

---

```js
import { CONFIG } from './js/config.js';
import { getTimestamp, copyToClipboard, parseEntries, addEntryToSection, generateCategorySections, setupCategoryToggles } from './js/tools.js';

```
# Michael 👨‍🦰

 <button class="timestamp-btn">Copy Current Time</button>
    <div id="timestamp-display"></div>

<div class="filter-container">
<details open>
<summary>Time Filters</summary>
    <label><input type="radio" name="date-filter" value="today"> Today</label>
    <label><input type="radio" name="date-filter" value="yesterday"> Yesterday</label><br>
    <label><input type="radio" name="date-filter" value="this_week" checked> This Week</label>
    <label><input type="radio" name="date-filter" value="last_week"> Last Week</label><br>
    <label><input type="radio" name="date-filter" value="this_month"> This Month</label>
    <label><input type="radio" name="date-filter" value="last_month"> Last Month</label>
    <label><input type="radio" name="date-filter" value="last_4_months"> Last 4 Months</label><br>
    <label><input type="radio" name="date-filter" value="this_year"> This Year</label>
    <label><input type="radio" name="date-filter" value="last_year"> Last Year</label>
    <label><input type="radio" name="date-filter" value="all_time"> All Time</label><br>
    <label><input type="radio" name="date-filter" value="future"> Future</label>
    </details>
</div>

<div class='notes-container'></div>

```js

const filterRadios = document.querySelectorAll('input[name="date-filter"]');

// Function to check if a date falls into the selected range
// Function to check if a date falls into the selected range
const isWithinRange = (entryDate, filter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Sunday start
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear(), 0, 0);

    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(now.getMonth() - 4);

    switch (filter) {
        case 'today':
            return entryDate >= today;
        case 'yesterday':
            return entryDate >= yesterday && entryDate < today;
        case 'this_week':
            return entryDate >= thisWeekStart;
        case 'last_week':
            return entryDate >= lastWeekStart && entryDate <= lastWeekEnd;
        case 'this_month':
            return entryDate >= thisMonthStart;
        case 'last_month':
            return entryDate >= lastMonthStart && entryDate <= lastMonthEnd;
        case 'this_year':
            return entryDate >= thisYearStart;
        case 'last_year':
            return entryDate >= lastYearStart && entryDate <= lastYearEnd;
        case 'last_4_months':
            return entryDate >= fourMonthsAgo;
        case 'future':
            return entryDate > now;
        case 'all_time':
            return true; // Show all entries
        default:
            return true;
    }
};

// Load existing entries
let allEntries = [];

const loadEntries = async () => {
    try {
        const text = await FileAttachment("./data/todo.txt").text();
        allEntries = parseEntries(text);

        const container = document.querySelector("#observablehq-center");
        if (!container) {
            console.error("Error: #observablehq-center not found.");
            return;
        }

        // ✅ Ensure `.notes-container` exists before adding entries
        if (document.querySelector("#observablehq-main")) {
            const sectionsHTML = generateCategorySections(allEntries);
            const wrapper = document.createElement("div");
            wrapper.innerHTML = sectionsHTML;
            document.querySelector("#observablehq-main").appendChild(wrapper);
      
        }

        setupCategoryToggles(); // Enable checkboxes
        filterEntries(); // Apply filters and add entries
    } catch (err) {
        console.error("Failed to load entries:", err);
    }
};


// Filter and update displayed entries
const filterEntries = () => {
    const selectedFilter = document.querySelector('input[name="date-filter"]:checked').value;
    
    // Clear all sections before re-adding filtered entries
    document.querySelectorAll('.entries').forEach(div => div.innerHTML = '');

    allEntries.forEach(entry => {
        if (isWithinRange(entry.date, selectedFilter)) {
            addEntryToSection(entry);
        }
    });
};

// Add event listeners for radio buttons
filterRadios.forEach(radio => {
    radio.addEventListener('change', filterEntries);
});


```


```js
    loadEntries();
```

<style>
    .entry {
    padding: 8px;
    margin: 5px 0;
    border-radius: 5px;
    color: #fff;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 8px;
}

.flag-icon {
    font-size: 1.2em;
}

.filter-container {
    margin-bottom: 10px;
    display: grid;
    gap: 10px;
    font-size: 14px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
}


.filter-container input {
    margin-right: 5px;
}

.entry {
    transition: filter 0.3s ease-in-out, transform 0.2s ease-in-out;
}

.entry:hover {
    filter: brightness(1) drop-shadow(2px 4px 8px rgba(0, 0, 0, 0.5)) !important; /* Softer shadow */
    transform: translateY(-2px); /* Slight lift effect */
    cursor:pointer
}

.entry {
    position: relative;
    padding: 10px;
    margin: 5px 0;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: background 0.3s ease-in-out;
}

.entry {
    position: relative;
    padding: 10px;
    margin: 5px 0;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: background 0.3s ease-in-out;
}

.entry.expanded {
    background: rgba(255, 255, 255, 0.3);
    filter: brightness(1) !important; /* Softer shadow */
}

.details {
    padding: 8px;
    margin-top: 5px;
    border-left: 3px solid rgba(0, 0, 0, 0.3);
    border-bottom: 3px solid rgba(0, 0, 0, 0.3);
    background: rgba(0, 0, 0, 0.05);
    font-size: 14px;
    transition: max-height 0.3s ease-in-out, opacity 0.2s ease-in-out;
    overflow: hidden;
    max-height: 0; /* Default: Hidden */
    opacity: 0;

}

.category-filters{
        right: 0;
    position: absolute;
    z-index:100000
}
    </style>