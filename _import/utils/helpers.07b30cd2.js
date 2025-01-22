import {gsap} from "../../_npm/gsap@3.12.5/all.d47bb9de.js"

// utils/helpers.js


export function setVisibility(element, isVisible) {
    element.style.display = isVisible ? 'block' : 'none';
  }

export function linkComponents(state, property, components) {
    components.forEach(component => {
      // Subscribe component to state changes
      state.subscribe(property, (newValue) => {
        if (component.update) {
          component.update(newValue);
        }
      });
  
      // Update state when component changes
      if (component.onChange) {
        component.onChange = (value) => {
          state.setProperty(property, value);
        };
      }
    });
  }

  // src/utils/InteractionManager.js

export class InteractionManager {
  /**
   * Add a click listener to the given element.
   * @param {Element} element - The target element.
   * @param {Function} callback - The function to call on click.
   */
  addClickListener(element, callback) {
    if (element) {
      element.addEventListener('click', callback);
    } else {
      console.warn('Element is undefined. Cannot attach click listener.');
    }
  }

  /**
   * Add a swipe listener to the given element.
   * Detects direction and triggers callback with direction.
   * @param {Element} element - The target element.
   * @param {Function} callback - The function to call on swipe.
   */
  addSwipeListener(element, callback) {
    if (!element) {
      console.warn('Element is undefined. Cannot attach swipe listener.');
      return;
    }
    
    let touchStartX = 0;
    let touchEndX = 0;

    // Track touch start position
    element.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0].screenX;
    });

    // Track touch end position
    element.addEventListener('touchend', (event) => {
      touchEndX = event.changedTouches[0].screenX;
      handleSwipeGesture();
    });

    // Function to handle swipe direction
    const handleSwipeGesture = () => {
      if (touchEndX < touchStartX - 50) {
        // Swipe left
        callback('left');
      } else if (touchEndX > touchStartX + 50) {
        // Swipe right
        callback('right');
      }
    };

  /**
   * Add a custom event listener.
   * @param {Element} element - The target element.
   * @param {string} eventName - Custom event name.
   * @param {Function} callback - The function to call on event trigger.
  **/
/*
  addCustomListener(element, eventName, callback) {
    element.addEventListener(eventName, callback);
  }*/
}}
/*

*/
// Animation defaults
export const retroDefaults = {
  follow: {
      duration: 60,
      ease: "expo.inOut",
      repeat: -1,
      yoyo:true
  },
  rotate: {
      duration: 40,
      ease: "none",
      transformOrigin: "center center",
      repeat:-1,
      repeatDelay: 0
  },
    // Regular on/off cycling
    blink: {
      opacity: {
        on: 1,
        off: 0
      },
      duration: 0.5,
      ease: "none",
      yoyo: true
    },
  
    // Pattern-based signaling 
    morse: {
      timing: {
        dot: 0.2,    // Short pulse
        dash: 0.6,   // Long pulse
        pause: 0.2,  // Between characters
        word: 0.6    // Between words
      },
      intensity: {
        on: 1,
        dim: 0.3
      }
    },
  
    // Random/chaotic variation
    flicker: {
      opacity: {
        min: 0.4,
        max: 1
      },
      duration: {
        min: 0.05,
        max: 0.2
      },
      ease: "power1.inOut",
      random: true
    }
};

export async function injectSVG(filePath, containerId) {
    // Define the effect functions
    const retroEffects = {
      blink: (element) => {
        gsap.to(element, {
          ...retroDefaults.blink,
          repeat: -1
        });
      },
  
      morse: (element) => {
        const timings = retroDefaults.morse.timing;
        const patterns = [".-.","---","...","...---..."][Math.floor(Math.random() * 4)];
        const intensities = [0.5,0.75][Math.floor(Math.random() * 3)];
        
        let timeline = gsap.timeline({repeat: -1});
        
        patterns.split('').forEach(char => {
          switch(char) {
            case '.':
              timeline.to(element, {
                autoAlpha: 1,
                duration: timings.dot,
              })
              .to(element, {
                autoAlpha: intensities,
                duration: timings.dot,
              });
              break;
              
            case '-':
              timeline.to(element, {
                autoAlpha: 1,
                duration: timings.dash,
              })
              .to(element, {
                autoAlpha: intensities,
                duration: timings.dash,
              });
              break;
        
            case ' ':
              timeline.to(element, {
                autoAlpha: intensities,
                duration: timings.pause
              });
              break;
              
            case '/':
              timeline.to(element, {
                autoAlpha: intensities,
                duration: timings.word
              });
              break;
          }
        });
        
        return timeline;
      },
  
      flicker: (element) => {
        const flicker = () => {
          gsap.to(element, {
            autoAlpha: gsap.utils.random(0.4, 1),
            duration: gsap.utils.random(0.05, 0.2),
            ease: "power1.inOut",
            onComplete: flicker
          });
        };
        flicker();
      }
    };
  
  try {
      const response = await fetch(filePath);
      if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
      }

      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      const svgElement = svgDoc.documentElement;

      const container = document.getElementById(containerId);
      if (!container) {
          throw new Error(`Container with ID "${containerId}" not found.`);
      }

      container.appendChild(svgElement.cloneNode(true));
      let currentStep = 0;
      // Initialize all retro animations
      gsap.utils.toArray('[id^="fx-animate-"]').forEach(element => {
        // First check what type of animation we're dealing with
        const hasRotate = element.querySelector('[id^="fx-rotatecw-"]');
        const hasFollow = element.querySelector('[id^="fx-follow-"]');
        const hasRotateCC = element.querySelector('[id^="fx-rotatecc"]');
     
        // Handle rotation
        
        if (hasRotate) {
            gsap.to(hasRotate, {
                ...retroDefaults.rotate,
                rotation: "+=360",
                onRepeat: function() {
                  currentStep++;
                  console.log("Current Step: ", currentStep);
                  // Update your state here
                },
            })
        }

        if (hasRotateCC) {
          gsap.to(hasRotateCC, {
              ...retroDefaults.rotate,
              rotation: "-=360",
              onRepeat: function() {
                currentStep--;
                console.log("Current CC Step: ", currentStep);
                // Update your state here
              },
          })
      }
    
        // Handle path following
        if (hasFollow) {
            const pathElement = element.querySelector('[id^="fx-path-"]');
            const objElement = element.querySelector('[id^="fx-object-"]');
            
            if (pathElement && objElement) {
                gsap.to(objElement, {
                    ...retroDefaults.follow,
                    motionPath: {
                        path: pathElement,
                        align: pathElement,
                        alignOrigin: [0.5, 0.5]
                    }
                });
            }
        }
    });
    
        
    
      // Apply lighting effects based on id prefix
      ['blink', 'morse', 'flicker'].forEach(effectType => {
        gsap.utils.toArray(`[id^="fx-${effectType}"]`).forEach(element => {
          retroEffects[effectType](element);
        });
      });
  
    } catch (error) {
      console.error('Error injecting SVG:', error);
    }
  }
