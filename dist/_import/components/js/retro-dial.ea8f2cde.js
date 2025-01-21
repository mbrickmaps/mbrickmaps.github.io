import * as Inputs from "../../../_observablehq/stdlib/inputs.e0c0bc10.js";
import { gsap } from "../../../_npm/gsap@3.12.5/all.d47bb9de.js";

export class RetroDial {
    constructor(container, slider, options = {}) {
      this.container = container;
      this.slider = slider; // Reference to the slider control
      this.threshold = options.threshold || 10; // Movement threshold in pixels
      this.minAngle = options.minAngle || 0;
      this.maxAngle = options.maxAngle || 360;
      this.cssTemplate = options.cssTemplate || ""; // Transformation template for non-SVG elements
      this.cssSelector = options.cssSelector || null; // Target page elements (outside of SVG)
      this.values = options.values || [{ min: 0, max: 360 }]; // Default to rotate range for cssSelector
      this.svgElementIds = options.svgElementIds || []; // Array of SVG element IDs to rotate
  
      // To store the start and end positions of the mouse
      this.startX = 0;
      this.startY = 0;
      this.endX = 0;
      this.endY = 0;
  
      this.isDragging = false; // Flag to check if the user is dragging
  
      // Store references to the targeted SVG elements
      this.svgElements = [];
  
      // Initialize the slider to control the animation
      this.initializeSlider();
      this.initializeMouseEvents();
      this.initializeSvgElements(); // Initialize SVG element selection
    }
  
    // Initialize slider control for the animation
    initializeSlider() {
      this.slider.addEventListener("input", () => {
        this.updateTransforms();
      });
    }
  
    // Initialize mouse/touch events to control the slider
    initializeMouseEvents() {
      // Add event listeners to the container
      this.container.addEventListener('mousedown', (event) => this.onMouseDown(event));
      document.addEventListener('mousemove', (event) => this.onMouseMove(event));
      document.addEventListener('mouseup', (event) => this.onMouseUp(event));
    }
  
    // Initialize the list of SVG elements based on their IDs
    initializeSvgElements() {
      this.svgElementIds.forEach(id => {
        const svgElement = document.getElementById(id);
        if (svgElement) {
          this.svgElements.push(svgElement);
        } else {
          console.warn(`SVG element with ID ${id} not found.`);
        }
      });
    }
  
    onMouseDown(event) {
      this.isDragging = true; // Start tracking movement
      this.startX = event.clientX;
      this.startY = event.clientY;
    }
  
    onMouseMove(event) {
      if (!this.isDragging) return; // Only track if dragging
      this.endX = event.clientX;
      this.endY = event.clientY;
    }
  
    onMouseUp(event) {
      if (!this.isDragging) return; // If not dragging, do nothing
  
      this.isDragging = false; // Stop tracking movement
      this.endX = event.clientX;
      this.endY = event.clientY;
  
      // Calculate the movement delta
      const deltaX = this.endX - this.startX;
      const deltaY = this.endY - this.startY;
  
      // Check if the movement exceeds the threshold and adjust slider
      if (Math.abs(deltaX) > this.threshold || Math.abs(deltaY) > this.threshold) {
        // Adjust the slider value based on movement
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
        this.adjustSliderValue(delta);
      }
    }
  
    // Adjust the slider value based on movement
    adjustSliderValue(delta) {
      const step = this.slider.step || 1; // Default step is 1 if not defined
      const newValue = Math.max(this.minAngle, Math.min(this.maxAngle, this.slider.value + delta * step));
      this.slider.value = newValue;
  
      // Trigger the animation update via slider input
      this.slider.dispatchEvent(new Event("input"));
    }
  
    // Update CSS transforms based on the slider value
    updateTransforms() {
      const sliderValue = this.slider.value; // Use the slider value directly for rotation
      console.log(sliderValue,this.cssSelector)
      // Apply the transformation string from cssTemplate to elements matched by cssSelector
      if (this.cssSelector) {
        const cssElements = document.querySelectorAll(this.cssSelector);
        let transformedCSS = this.cssTemplate
          .split('|')
          .map((segment, index) => {
            return segment.replace('#', sliderValue);
          })
          .join(' ');
  
        cssElements.forEach((el) => {
          console.log(transformedCSS)
          el.style.filter = transformedCSS;
        });
  
        console.log(`Updated transform for CSS elements to: ${transformedCSS}`);
      }
    }
  }

  export class RetroButton {
    constructor(
      width,
      height,
      color = '#8b0000',
      text = 'Button',
      isActive = false,
      radius = "0px",
      textColor = '#000000',     // New property for text color
      fontFamily = 'Futura_Bold',      // New property for font family
      fontSize = '14px'          // New property for font size
  ) {
      this.width = width;
      this.height = height;
      this.color = color;
      this.text = text;
      this.isActive = isActive;
      this.radius = radius;
      this.textColor = textColor;
      this.fontFamily = fontFamily;
      this.fontSize = fontSize;
  }

  updateAppearance() {

    if (this.isActive) {
      // Add active class or apply active styles
      document.getElementById(this.svgId).classList.add('active');
      // Additional code for active state
    } else {
      // Remove active class or reset styles
      document.getElementById(this.svgId).classList.remove('active');
      // Additional code for inactive state
    }
  }

  toggleLight() {
    this.isActive = !this.isActive;
    this.updateAppearance()
  }

    createLight() {
        const svgNS = "http://www.w3.org/2000/svg";
        const uniqueId = `light-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("id", uniqueId);
        svg.setAttribute("width", this.width);
        svg.setAttribute("height", this.height);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        const minFrequency = 0.01;
        const maxFrequency = 0.2;
        const randomFrequency = Math.random() * (maxFrequency - minFrequency) + minFrequency;

        const minOpacity = 0.3 
        const maxOpacity =  0.6
        const randomOpacity = Math.random() * (maxOpacity - minOpacity) + minOpacity;

        // Define gradient and filter in defs
        const defs = document.createElementNS(svgNS, "defs");

        const lightGlowGradient = document.createElementNS(svgNS, "radialGradient");
        lightGlowGradient.setAttribute("id", "light-glow-gradient");
        lightGlowGradient.setAttribute("cx", "50%");
        lightGlowGradient.setAttribute("cy", "50%");
        lightGlowGradient.setAttribute("r", "50%");

        const glowCenterStop = document.createElementNS(svgNS, "stop");
        glowCenterStop.setAttribute("offset", "0%");
        glowCenterStop.setAttribute("stop-color", "#ffffff");
        glowCenterStop.setAttribute("stop-opacity", 0.5);
        lightGlowGradient.appendChild(glowCenterStop);
        
        const glowEdgeStop = document.createElementNS(svgNS, "stop");
        glowEdgeStop.setAttribute("offset", "100%");
        glowEdgeStop.setAttribute("stop-color", "#ffffff");
        glowEdgeStop.setAttribute("stop-opacity", 0);
        lightGlowGradient.appendChild(glowEdgeStop);
        
        defs.appendChild(lightGlowGradient);

        // Vignette Effect using Radial Gradient
        const vignetteLayer = document.createElementNS(svgNS, "rect");
        vignetteLayer.setAttribute("x", "0");
        vignetteLayer.setAttribute("y", "0");
        vignetteLayer.setAttribute("width", "100%");
        vignetteLayer.setAttribute("height", "100%");
        vignetteLayer.setAttribute("fill", "url(#vignette-gradient)");
        //vignetteLayer.setAttribute("opacity", 0); // Adjust opacity for vignette strength
        vignetteLayer.classList.toggle('vignette-active', this.isActive);
        vignetteLayer.setAttribute("style", "mix-blend-mode: overlay;")

        // Define the vignette gradient in <defs>
        const vignetteGradient = document.createElementNS(svgNS, "radialGradient");
        vignetteGradient.setAttribute("id", "vignette-gradient");
        vignetteGradient.setAttribute("cx", "50%");
        vignetteGradient.setAttribute("cy", "50%");
        vignetteGradient.setAttribute("r", "70%"); // Adjust radius to control fade distance

        // Center is transparent
        const vignetteCenter = document.createElementNS(svgNS, "stop");
        vignetteCenter.setAttribute("offset", "70%");
        vignetteCenter.setAttribute("stop-color", "#ffffff");
        vignetteCenter.setAttribute("stop-opacity",1);
        vignetteGradient.appendChild(vignetteCenter);
        defs.appendChild(vignetteGradient);
        // Edges fade to black
        const vignetteEdge = document.createElementNS(svgNS, "stop");
        vignetteEdge.setAttribute("offset", "100%");
        vignetteEdge.setAttribute("stop-color", "#000000");
        vignetteEdge.setAttribute("stop-opacity", 1); // Subtle darkening at the edges
        vignetteGradient.appendChild(vignetteEdge);

        const dirtFilter = document.createElementNS(svgNS, "filter");
        dirtFilter.setAttribute("id", "dirt-buildup");

        const feTurbulence = document.createElementNS(svgNS, "feTurbulence");
        feTurbulence.setAttribute("type", "fractalNoise");
        feTurbulence.setAttribute("baseFrequency", randomFrequency);
        feTurbulence.setAttribute("numOctaves", "6");
        feTurbulence.setAttribute("seed", "2");
        feTurbulence.setAttribute("result", "dirtTexture");

        const feDisplacementMap = document.createElementNS(svgNS, "feDisplacementMap");
        feDisplacementMap.setAttribute("in", "SourceGraphic");
        feDisplacementMap.setAttribute("in2", "dirtTexture");
        feDisplacementMap.setAttribute("scale", "30");

        dirtFilter.appendChild(feTurbulence);
        dirtFilter.appendChild(feDisplacementMap);
        defs.appendChild(dirtFilter);

        // Layers
        const base = document.createElementNS(svgNS, "rect");
        base.setAttribute("width", "100%");
        base.setAttribute("height", "100%");
        base.setAttribute("fill", this.color);
        base.classList.add('retro-button-base')

        // Group for the inner glow effect
        const glowGroup = document.createElementNS(svgNS, "g");
        glowGroup.setAttribute("style", "mix-blend-mode: overlay;"); // Apply blend mode to the group
        //glowGroup.classList.add('flicker-broken')
        glowGroup.setAttribute("opacity", randomOpacity);
        const glowLayers = 25;
        const glowColor = "#ffffff";
        for (let i = 0; i < glowLayers; i++) {
            const inset = document.createElementNS(svgNS, "rect");
            const insetSize = ((1 - i / glowLayers) * 100).toFixed(5);
  
            inset.setAttribute("x", (100 - insetSize) / 2+`%`);
            inset.setAttribute("y", (100 - insetSize) / 2+`%`);
            inset.setAttribute("width", insetSize+`%`);
            inset.setAttribute("height", insetSize+`%`);
            inset.setAttribute("fill", glowColor);
            inset.setAttribute("opacity", (0.1 + (0.02 * i) / glowLayers).toFixed(5));
            glowGroup.appendChild(inset);
        }

        const lineGroup = document.createElementNS(svgNS, "g");
        for (let i = 0; i < this.height; i += 4) {
            const line = document.createElementNS(svgNS, "rect");
            line.setAttribute("x", "0");
            line.setAttribute("y", i);
            line.setAttribute("width", "100%");
            line.setAttribute("height", "2");
            line.setAttribute("fill", "rgba(0, 0, 0, 0.3)");
            lineGroup.appendChild(line);
        }

        const dodgeGroup = document.createElementNS(svgNS, "g");
        for (let i = 0; i < this.height; i += 2) {
            const dodgeLine = document.createElementNS(svgNS, "rect");
            dodgeLine.setAttribute("x", "0");
            dodgeLine.setAttribute("y", i);
            dodgeLine.setAttribute("width", "100%");
            dodgeLine.setAttribute("height", "0.5");
            dodgeLine.setAttribute("fill", "rgba(255, 255, 255, 0.6)");
            dodgeGroup.appendChild(dodgeLine);
        }

        const dirtOverlay = document.createElementNS(svgNS, "rect");
        dirtOverlay.setAttribute("x", "0");
        dirtOverlay.setAttribute("y", "0");
        dirtOverlay.setAttribute("width", "100%");
        dirtOverlay.setAttribute("height", "100%");
        dirtOverlay.setAttribute("fill", "#3b2f2f");
        dirtOverlay.setAttribute("opacity", randomOpacity);
        dirtOverlay.setAttribute("filter", "url(#dirt-buildup)");

        const lightGlow = document.createElementNS(svgNS, "rect");
        lightGlow.setAttribute("x", "0");
        lightGlow.setAttribute("y", "0");
        lightGlow.setAttribute("width", "100%");
        lightGlow.setAttribute("height", "100%");
        lightGlow.setAttribute("fill", "url(#light-glow-gradient)");
        lightGlow.setAttribute("opacity", 0.7)
        
        const lightGlowFX = document.createElementNS(svgNS, "rect");
        lightGlowFX.setAttribute("x", "0");
        lightGlowFX.setAttribute("y", "0");
        lightGlowFX.setAttribute("width", "100%");
        lightGlowFX.setAttribute("height", "100%");
        lightGlowFX.setAttribute("fill", "yellow");
        lightGlowFX.setAttribute("opacity", 0.7)
        lightGlowFX.setAttribute("id", "fx-glow-");

               
        const lightGlowLight = document.createElementNS(svgNS, "rect");
        lightGlowLight.setAttribute("x", "0");
        lightGlowLight.setAttribute("y", "0");
        lightGlowLight.setAttribute("width", "100%");
        lightGlowLight.setAttribute("height", "100%");
        lightGlowLight.setAttribute("fill", "yellow");
        lightGlowLight.setAttribute("opacity", 0.7);
        lightGlowLight.setAttribute("id", "fx-light-");
        lightGlowLight.setAttribute("style", "mix-blend-mode: overlay;");
        lightGlowLight.classList.add('glow-effect');


        const textElement = document.createElementNS(svgNS, "text");
        textElement.setAttribute("x", "50%");
        textElement.setAttribute("y", "50%");
        textElement.setAttribute("class", "retro-text");
        textElement.setAttribute("fill", this.textColor);
        textElement.setAttribute("font-family", this.fontFamily);
        textElement.setAttribute("font-size", this.fontSize);
        textElement.setAttribute("stroke", this.textColor);
        textElement.setAttribute("stroke-width", "1px");
        textElement.setAttribute("paint-order", "stroke");
        textElement.setAttribute("style", "mix-blend-mode: darker;")
        textElement.textContent = this.text;

        const textElementOutline = document.createElementNS(svgNS, "text");
        textElementOutline.setAttribute("x", "50%");
        textElementOutline.setAttribute("y", "50%");
        textElementOutline.setAttribute("class", "retro-text");
        textElementOutline.setAttribute("fill", "none");
        textElementOutline.setAttribute("font-family", this.fontFamily);
        textElementOutline.setAttribute("font-size", this.fontSize);
        textElementOutline.setAttribute("stroke", "black");
        textElementOutline.setAttribute("stroke-width", "0.5px");
        textElementOutline.setAttribute("paint-order", "stroke");
        textElementOutline.textContent = this.text;
        
        textElementOutline.setAttribute("style", "mix-blend-mode: color;")

        const pointerGroup = document.createElementNS(svgNS, "g");
        pointerGroup.setAttribute("style","pointer-events:none")

        const colorize = document.createElementNS(svgNS, "rect");
        colorize.setAttribute("x", "0");
        colorize.setAttribute("y", "0");
        colorize.setAttribute("width", "100%");
        colorize.setAttribute("height", "100%");
        colorize.setAttribute("fill", "darkslategray");
        colorize.setAttribute("opacity", 0.4);
        colorize.setAttribute("style", "mix-blend-mode: color-burn;")

        // Append elements to the SVG at the end, with blend modes applied here
        svg.appendChild(defs);
        svg.appendChild(base);
        pointerGroup.appendChild(glowGroup); // Append the intense inner glow group
        pointerGroup.appendChild(lineGroup);
        lineGroup.setAttribute("style", "mix-blend-mode: normal;");

        pointerGroup.appendChild(dodgeGroup);
        dodgeGroup.setAttribute("style", "mix-blend-mode: color;");

        pointerGroup.appendChild(lightGlow);
        lightGlow.setAttribute("style", "mix-blend-mode: screen;");
        vignetteLayer.setAttribute("style", "mix-blend-mode: multiply;");
        pointerGroup.appendChild(vignetteLayer); // Append vignette layer at the end
        pointerGroup.appendChild(dirtOverlay);
        dirtOverlay.setAttribute("style", "mix-blend-mode: color-burn;");
        svg.appendChild(pointerGroup);

        pointerGroup.appendChild(colorize);
        pointerGroup.appendChild(lightGlowLight);

        pointerGroup.appendChild(textElement);
        pointerGroup.appendChild(textElementOutline);
        
        svg.classList.add('retro-button');
        svg.classList.toggle('active', this.isActive);
        svg.style.borderRadius = this.radius;
        this.svgId = uniqueId;
        return svg;

    }
}