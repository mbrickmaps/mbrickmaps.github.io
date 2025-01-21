import { InteractionManager } from "../../utils/helpers.07b30cd2.js";

export class RetroRadio {
  /**
     * @param {Object} state - Centralized state object.
     * @param {string} property - State property to control.
     * @param {Array} options - Radio options [{value, label}].
     * @param {string} label - Label for the radio group.
     * @param {string} layout - Layout: "vertical" (default) or "horizontal".
     */
  constructor(state, property, options = [], label = "Choose an option", layout = "vertical") {
    this.state = state;
    this.property = property;
    this.options = options;
    this.layout = layout;

    this.element = this.createRadioGroup(label);

    this.attachListeners();

    // Sync initial selection with state
    this.updateSelection(this.state.getProperty(this.property));

    // Subscribe to state updates
    this.state.subscribe(this.property, (newValue) => {
        this.updateSelection(newValue);
    });
}

createRadioGroup(label) {
    const svgNS = "http://www.w3.org/2000/svg";
    const container = document.createElement("div");
    container.className = "retro-radio-svg-group";

    if (label) {
        const groupLabel = document.createElement("label");
        groupLabel.textContent = label;
        container.appendChild(groupLabel);
    }

    const svg = document.createElementNS(svgNS, "svg");
    const spacing = 50;

    if (this.layout === "horizontal") {
        svg.setAttribute("width", `${spacing * this.options.length}`);
        svg.setAttribute("height", "50");
    } else {
        svg.setAttribute("width", "200");
        svg.setAttribute("height", `${spacing * this.options.length}`);
    }

    container.appendChild(svg);

    this.options.forEach((option, index) => {
        const group = document.createElementNS(svgNS, "g");
        const x = this.layout === "horizontal" ? index * spacing : 10;
        const y = this.layout === "horizontal" ? 10 : index * spacing;

        group.setAttribute("transform", `translate(${x}, ${y})`);

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", "20");
        circle.setAttribute("cy", "20");
        circle.setAttribute("r", "15");
        circle.setAttribute("stroke", "#000");
        circle.setAttribute("fill", "#ddd");

        /*const textLabel = document.createElementNS(svgNS, "text");
        textLabel.setAttribute("x", "50");
        textLabel.setAttribute("y", "25");
        textLabel.setAttribute("font-size", "16");
        textLabel.textContent = option.label;*/

        group.appendChild(circle);
        //group.appendChild(textLabel);
        svg.appendChild(group);

        // Clicking the group updates the state
        group.addEventListener("click", () => {
            console.log(this.property,  option.value)
            this.state.setProperty(this.property, option.value);
        });
    });

    return container;
}

attachListeners() {
    // Sync through state changes only
}

updateSelection(newValue) {
    this.element.querySelectorAll("g").forEach((group, index) => {
        const isSelected = this.options[index].value === newValue;
        group.querySelector("circle").setAttribute("fill", isSelected ? "#ff0" : "#ddd");
    });
}
}
