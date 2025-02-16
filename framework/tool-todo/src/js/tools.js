import { CONFIG } from './config.js';

const applyHueShift = (hue, shiftType) => {
    const shifts = {
        "c": 180,
        "tri": 120,
        "an": 30,  // ±30° for subtle effect
        "sc": 150,
        "custom": 45
    };

    let shift = shifts[shiftType] || 0;
    return (hue + shift) % 360; // Keep within 0-360 range
};

export const generateCategorySections = (entries) => {
    // Extract unique categories from entries
    const uniqueBuckets = [...new Set(entries.map(entry => entry.bucket.trim()))];

    return `
        <div class="category-filters">
            ${uniqueBuckets
                .map(bucket => {
                    const category = CONFIG.categories.find(c => c.emoji === bucket);
                    const label = category ? `${category.emoji} ${category.name}` : bucket;

                    return `
                        <label>
                            <input type="checkbox" class="category-toggle" data-category="${bucket}" checked>
                            ${label}
                        </label>
                    `;
                })
                .join("")
            }
        </div>
        <div class="notes-container">
            ${uniqueBuckets
                .map(bucket => {
                    const category = CONFIG.categories.find(c => c.emoji === bucket);
                    const header = category ? `${category.emoji} ${category.name}` : bucket;

                    return `
                        <div class="category-section" data-category="${bucket}">
                            <h2 class="section-header">${header}</h2>
                            <div class="entries"></div>
                        </div>
                    `;
                })
                .join("")
            }
        </div>
    `;
};


// Function to handle category toggling
export const setupCategoryToggles = () => {
    document.querySelectorAll('.category-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const categoryEmoji = e.target.dataset.category;
            const categorySection = document.querySelector(`.category-section[data-category="${categoryEmoji}"]`);
            if (categorySection) {
                categorySection.style.display = e.target.checked ? "block" : "none";
            }
        });
    });
};

const hexToHSL = (hex) => {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // Grayscale
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h = Math.round(h * 60);
    }

    return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToHex = (h, s, l) => {
    s /= 100;
    l /= 100;
    
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));

    return `#${[f(0), f(8), f(4)]
        .map(x => Math.round(x * 255)
        .toString(16)
        .padStart(2, '0'))
        .join('')}`;
};

const shiftHue = (hex, shift) => {
    let { h, s, l } = hexToHSL(hex);
    h = (h + shift) % 360;  // Ensure it stays within 0-360 range
    return hslToHex(h, s, l);
};

const generateCSSFilter = (hex, shiftType) => {
    const { h } = hexToHSL(hex);
    const newHue = applyHueShift(h, shiftType);
    return `filter: grayscale(100%) hue-rotate(${newHue}deg);`;
};

const generateCSSFilterNative = (mode) => {
    /**
     * grayscale, sepia, invert
     */
    return `filter: ${mode}(1);
}`;
};

// Ensure entry parsing handles bucket extraction correctly
export const parseEntries = (rawData) => {
    return rawData.split('\n')
        .filter(line => line.trim()) // Remove empty lines
        .map(line => {
            const parts = line.split('|');
            if (parts.length < 5) {
                console.warn("Skipping invalid entry:", line);
                return null;
            }

            const [flag, timestamp, bucket, note, details] = parts;
            return {
                flag: flag || '',
                timestamp,
                date: new Date(timestamp),
                bucket: bucket.trim(),
                note: note.trim(),
                details: details ? details.trim() : '' // Extra context
            };
        })
        .filter(entry => entry !== null)
        .sort((a, b) => b.date - a.date);
};

export const addEntryToSection = (entry) => {
    console.log("Adding entry:", entry); // Debugging

    const headers = document.querySelectorAll('.section-header');

    // ✅ Fix: Match category by exact emoji OR name
    const matchingCategory = CONFIG.categories.find(
        c => entry.bucket.trim() === c.emoji || entry.bucket.trim() === c.name
    );

    if (!matchingCategory) {
        console.error(`No category found for: ${entry.bucket}`);
        return;
    }

    // ✅ Find the exact matching header
    const matchingHeader = Array.from(headers).find(
        h => h.textContent.includes(matchingCategory.emoji) || h.textContent.includes(matchingCategory.name)
    );

    if (!matchingHeader) {
        console.error(`No section header found for: ${entry.bucket}`);
        return;
    }

    // ✅ Find the correct `.entries` div below the header
    const entriesDiv = matchingHeader.nextElementSibling;
    if (!entriesDiv || !entriesDiv.classList.contains('entries')) {
        console.error(`No div found for entries: ${matchingCategory.emoji}`);
        return;
    }

    // ✅ Create the main entry container
    const entryElement = document.createElement('div');
    entryElement.className = 'entry';

    // ✅ Assign category color
    const categoryColor = matchingCategory.color || "#DDD"; // Default gray
    entryElement.style.backgroundColor = categoryColor;

    // ✅ Assign text color using hue shift (optional)
    entryElement.style.color = shiftHue(categoryColor, 270);
    entryElement.style.filter = "brightness(0.9)";

    // ✅ Find and assign flag properties
    const flag = CONFIG.flags.find(f => f.symbol === entry.flag);
    const flagSpan = flag 
        ? `<span class="flag-icon" style="color: ${flag.colorShift};">${flag.icon}</span>` 
        : '';

    // ✅ Create expandable details drawer
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'details';
    detailsDiv.innerHTML = entry.details || "<i>No additional details available.</i>";
    detailsDiv.style.maxHeight = "0px";
    detailsDiv.style.overflow = "hidden";
    detailsDiv.style.transition = "max-height 0.3s ease-in-out, opacity 0.2s ease-in-out";
    detailsDiv.style.opacity = "0";

    // ✅ Set entry content
    entryElement.innerHTML = `${flagSpan} <strong>${entry.timestamp}</strong> - ${entry.note}`;

    // ✅ Peek Effect on Hover (Temporarily Shows Details)
    entryElement.addEventListener('mouseenter', () => {
        if (!entryElement.classList.contains("expanded")) {
            detailsDiv.style.maxHeight = "50px";
            detailsDiv.style.opacity = "1";
        }
    });

    entryElement.addEventListener('mouseleave', () => {
        if (!entryElement.classList.contains("expanded")) {
            detailsDiv.style.maxHeight = "0px";
            detailsDiv.style.opacity = "0";
        }
    });

    // ✅ Click to Toggle (Lock Open)
    entryElement.addEventListener('click', () => {
        if (entryElement.classList.contains("expanded")) {
            detailsDiv.style.maxHeight = "0px";
            detailsDiv.style.opacity = "0";
            entryElement.classList.remove("expanded");
        } else {
            detailsDiv.style.maxHeight = "300px"; // Fully expand
            detailsDiv.style.opacity = "1";
            entryElement.classList.add("expanded");
        }
    });

    entriesDiv.appendChild(entryElement);
    entriesDiv.appendChild(detailsDiv);
};