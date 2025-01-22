/**
 * Centralized State Management Object
 * 
 * This object manages the shared state across different components in the application.
 * It allows components to subscribe to specific state properties and get notified
 * whenever those properties change. Components can also update the state, which in turn
 * notifies all subscribed observers.
 */

export const state = {

    /**
   * `properties`: An object that holds all the shared state properties.
   * Each key represents a property name, and its value represents the current state.
   * Example:
   * {
   *   volume: 50,
   *   brightness: 75
   * }
   */

    properties: {},

    /**
   * `observers`: An object that maps each property to an array of observer functions.
   * These observer functions are called whenever the corresponding property changes.
   * Example:
   * {
   *   volume: [observer1, observer2],
   *   brightness: [observer3]
   * }
   */
    observers: {},
    
    /**
     * subscribe(property, observer)
     * 
     * Allows a component to subscribe to changes in a specific state property.
     * When the property changes, the observer function will be called with the new value.
     * 
     * @param {string} property - The name of the property to subscribe to.
     * @param {function} observer - The callback function to execute when the property changes.
     *
     * state.subscribe('volume', (newVolume) => {
     *      // Update the graphical dial with the new volume
     *     volumeDial.update(newVolume);
     *     }); 
     *
    */

    subscribe(property, observer) {
      if (!this.observers[property]) this.observers[property] = [];
      this.observers[property].push(observer);
    },
    
      /**
     * notify(property)
     * 
     * Notifies all observer functions subscribed to a specific property about its new value.
     * 
     * @param {string} property - The name of the property that has changed.
     * 
     * state.setProperty('volume', 75); // This will trigger `notify('volume')`
     */

    notify(property) {
      if (this.observers[property]) {
        this.observers[property].forEach(observer => observer(this.properties[property]));
      }
    },
    

    /**
     * setProperty(property, value)
     * 
     * Sets the value of a specific property in the state and notifies all its observers.
     * 
     * @param {string} property - The name of the property to update.
     * @param {*} value - The new value to assign to the property.
     * 
     *  volumeSlider.element.addEventListener('input', () => {
     *       state.setProperty('volume', volumeSlider.element.value);
     *   });
     * 
     */

    setProperty(key, value) {
      // Normalize both existing value and new value to strings for comparison
      const currentValue = String(this.properties[key]);
      const newValue = String(value);
  
      if (currentValue !== newValue) {  // Allow update only if different
          this.properties[key] = value; // Store the original type
          (this.observers[key] || []).forEach(callback => callback(value));
      }
  },
    
    /**
   * getProperty(property)
   * 
   * Retrieves the current value of a specific property from the state.
   * 
   * @param {string} property - The name of the property to retrieve.
   * @returns {*} The current value of the specified property.
   */

    getProperty(property) {
      return this.properties[property];
    }
  };
  