import { InteractionManager } from "../../utils/helpers.07b30cd2.js";

export class RetroComponent {
  constructor(state, property, options = {}) {
    this.state = state;
    this.property = property;
    this.options = options;
    this.interactionManager = new InteractionManager();
    this.element = this.createBaseElement();
    this.setupInteractions();
    this.setupStateSubscription();
  }

  createBaseElement() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    return svg;
  }

  setupInteractions() {
    this.interactionManager.addClickListener(this.element, this.handleClick.bind(this));
    this.interactionManager.addSwipeListener(this.element, this.handleSwipe.bind(this));
  }

  setupStateSubscription() {
    this.state.subscribe(this.property, (newValue) => {
      this.value = newValue;
      this.updateVisual();
    });
  }

  handleClick() {
    const currentValue = this.state.getProperty(this.property);
    const newValue = !currentValue;
    this.state.setProperty(this.property, newValue);
   }
   
   handleSwipe(direction) {
    if (direction === 'left' || direction === 'right') {
      this.handleClick();
    }
   }
   
  updateVisual() {
    // Override in child classes
  }
}