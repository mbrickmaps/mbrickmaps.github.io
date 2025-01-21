// components/retro/RetroLight.js

/**
 * RetroLight Component
 * 
 * Creates a graphical light that reflects a specific state property.
 * It updates the light's appearance when the state changes and updates the state when the light is interacted with.
 */
import { RetroComponent } from "./RetroComponent.cdbcd976.js";

export class RetroLight extends RetroComponent {
  createBaseElement() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "50");
    svg.setAttribute("height", "50");
    svg.style.cursor = 'pointer';
    svg.style.overflow = 'visible';

    // Base Circle remains dark
    const baseCircle = document.createElementNS(svgNS, "circle");
    baseCircle.setAttribute("cx", "25");
    baseCircle.setAttribute("cy", "25");
    baseCircle.setAttribute("r", "20");
    baseCircle.setAttribute("stroke", "#000");
    baseCircle.setAttribute("fill", "#555");
    baseCircle.setAttribute("stroke-width", "2");

    // Shadow provides depth
    const shadowCircle = document.createElementNS(svgNS, "circle");
    shadowCircle.setAttribute("id", "fx-shadow-");
    shadowCircle.setAttribute("cx", "25");
    shadowCircle.setAttribute("cy", "25");
    shadowCircle.setAttribute("r", "22");
    shadowCircle.setAttribute("fill", "#000");

    // Light circle shows illumination state
    const lightCircle = document.createElementNS(svgNS, "circle");
    lightCircle.setAttribute("id", "fx-light-");
    lightCircle.setAttribute("cx", "25");
    lightCircle.setAttribute("cy", "25");
    lightCircle.setAttribute("r", "16");
    lightCircle.setAttribute("stroke", "#f00");
    lightCircle.setAttribute("fill", "#ff0");
    lightCircle.setAttribute("opacity", "0");  // Start unlit

    // Glow provides the illumination effect
    const glowCircle = document.createElementNS(svgNS, "circle");
    glowCircle.setAttribute("id", "fx-glow-");
    glowCircle.setAttribute("cx", "25");
    glowCircle.setAttribute("cy", "25");
    glowCircle.setAttribute("r", "18");
    glowCircle.setAttribute("fill", "rgba(255, 255, 0, 1)");
    glowCircle.setAttribute("opacity", "0");  // Start unlit

    svg.appendChild(baseCircle);
    svg.appendChild(shadowCircle);
    svg.appendChild(lightCircle);
    svg.appendChild(glowCircle);

    this.svg = svg;
    return svg;
  }

  updateLight(isOn) {
    if (!this.svg) return;

    const lightElement = this.svg.querySelector("#fx-light-");
    const glowElement = this.svg.querySelector("#fx-glow-");

    if (isOn) {
      lightElement.setAttribute("fill", "#ff0");
      lightElement.setAttribute("stroke", "#f00");
      lightElement.setAttribute("opacity", "1");
      glowElement.setAttribute("opacity", "1");
      const pattern = glowElement.getAttribute("data-blink-pattern");
    if (pattern) {
      createBlinkingPattern(glowElement, pattern);
    }
    } else {
      lightElement.setAttribute("fill", "#555");
      lightElement.setAttribute("stroke", "#000");
      lightElement.setAttribute("opacity", "0");
      glowElement.setAttribute("opacity", "0");
    }
  }
}