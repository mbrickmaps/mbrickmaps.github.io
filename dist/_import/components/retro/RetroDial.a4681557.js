
/**
 * RetroDial Component
 * 
 * Creates a graphical dial that reflects a specific state property.
 * It updates the dial when the state changes and updates the state when the dial is interacted with.
 */
import {InteractionManager} from "../../utils/helpers.07b30cd2.js"

export class RetroDial {
  /**
   * @param {Object} state - The centralized state object.
   * @param {string} property - The state property this dial reflects.
   * @param {number} initialValue - The initial value of the dial.
   * @param {string|null} customSVG - Optional custom SVG string.
   */
    constructor(state, property, initialValue = 50, customSVG = null) {
      this.state = state;
      this.property = property;
      this.value = initialValue;
      this.element = this.createDialElement(customSVG);
  
       // Initialize InteractionManager
      this.interactionManager = new InteractionManager();

       // Initialize InteractionManager
      this.interactionManager = new InteractionManager();

      // Add swipe listener
      this.interactionManager.addSwipeListener(this.element, this.handleSwipe.bind(this));

      // Add click listener
      this.interactionManager.addClickListener(this.element, this.handleClick.bind(this));

      // Update dial when state changes
      this.state.subscribe(this.property, (newValue) => {
        this.value = newValue;
        this.updateDial();
      });
    }

  /**
   * Creates the SVG element representing the dial.
   * @param {string|null} customSVG - Optional custom SVG string.
   * @returns {SVGElement} The SVG element of the dial.
   */
  
    createDialElement(customSVG) {
      let svg;
    if (customSVG) {
      // Create a container div to hold the custom SVG
      const container = document.createElement('div');
      container.innerHTML = customSVG.trim(); // Trim to remove any unwanted whitespace

      // Assume the first child is the SVG
      svg = container.querySelector('svg');
      if (!svg) {
        console.warn('Custom SVG does not contain an <svg> element.');
        return container;
      }

      // Locate the indicator within the custom SVG
      this.indicator = svg.querySelector('#retro-indicator');
      if (!this.indicator) {
        console.warn('Custom SVG does not contain an element with id="indicator".');
      }
    } else {
      // Create a default SVG
      const svgNS = "http://www.w3.org/2000/svg";
      svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", "100");
      svg.setAttribute("height", "100");

      // Create a circle to represent the dial
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", "50");
      circle.setAttribute("cy", "50");
      circle.setAttribute("r", "40");
      circle.setAttribute("stroke", "#000");
      circle.setAttribute("stroke-width", "3");
      circle.setAttribute("fill", "#ddd");
      svg.appendChild(circle);

      // Create a line to represent the dial indicator
      this.indicator = document.createElementNS(svgNS, "line");
      this.indicator.setAttribute("id", "retro-indicator"); // Assign an ID for consistency
      this.indicator.setAttribute("x1", "50");
      this.indicator.setAttribute("y1", "50");
      this.indicator.setAttribute("x2", "50");
      this.indicator.setAttribute("y2", "10");
      this.indicator.setAttribute("stroke", "#f00");
      this.indicator.setAttribute("stroke-width", "2");
      svg.appendChild(this.indicator);

      // Add click event listener to toggle state
      svg.addEventListener('click', () => {
        /*const newValue = this.value >= 50 ? 0 : 100;
        this.state.setProperty(this.property, newValue);*/
        console.log("clicked event from RetroDial.js")
      });
    }

    return svg;
  
  }    
    // Make the dial interactive (e.g., draggable)
    // This is a simplified example; consider adding proper drag functionality
  
    
  
    /**
   * Updates the visual representation of the dial based on the current value.
   */

    handleClick() {
      console.log('Dial clicked');
      this.state.setProperty(this.property, this.value >= 50 ? 0 : 100);
    }
  
    handleSwipe(direction) {
      console.log(`Swipe detected: ${direction}`);
      const newValue = direction === 'right' || direction === 'down' ? this.value + 10 : this.value - 10;
      this.state.setProperty(this.property, Math.max(0, Math.min(100, newValue)));
    }
    updateDial() {
      if (!this.indicator) {
        console.warn('Indicator element is not defined. Cannot update dial.');
        return;
      }
 
      // Calculate the angle based on the value (0-100 mapped to 0-360 degrees)
      //const angle = (this.value / 100) * 360;
  
      // Apply rotation to the indicator
      //this.indicator.setAttribute("transform", `rotate(${angle.toFixed(3)} 50 50)`);
    }
}