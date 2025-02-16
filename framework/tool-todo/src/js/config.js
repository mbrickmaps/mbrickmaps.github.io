export const CONFIG = {
    flags: [
        { symbol: "!", name: "Important", description: "Don't forget this", icon: "⚠️"},
        { symbol: "i", name: "Ignore", description: "Backburner", icon: "🚫"},
        { symbol: "^", name: "Priority", description: "DO ASAP", icon: "🔥"},
        { symbol: "?", name: "Question", description: "Awaiting an answer",icon:"⁉️"},
        { symbol: "+", name: "Followup", description: "Needs communication", icon: "🔄"},
        { symbol: "w", name: "Wait", description: "Waiting for something, not blocked", icon: "🖐️"},
        { symbol: "b", name: "Blocked", description: "Blocker", icon: "⛔"},
        { symbol: "@", name: "Link", description: "External URL", icon: "🔗" },
        { symbol: "a", name: "Archive", description: "Sepia tone, archived", icon: "📜" },
        { symbol: "s", name: "Snapshot", description: "Saved URL", icon: "📸"}
    ],

    categories: [
        { emoji: "💡", name: "Brainstorming", description: "Ideas", color: "#FFDD57" },
        { emoji: "🔍", name: "Inquiries", description: "Requests", color: "#4DA8DA" },
        { emoji: "⚾", name: "Pitches", description: "Concepts", color: "#FF5733" },
        { emoji: "🚧", name: "Projects", description: "Realness", color: "#A933FF" },
        { emoji: "🧰", name: "Tools", description: "Helpers", color: "#2ECC71" }
    ]
};
