import * as Inputs from "../../../_node/@observablehq/inputs@0.12.0/index.4eed0a6e.js";

/**
 * rotate-cw
 * rotate
 * rotate-ccw
 * rotate-45
 * 
 *    360/0
 *  270   90
 *     180
 * random(-100, 100, 5)
 * random([0, 100, 200, 500])
 * [id^="volumeDial"][data-type="control"]
 * GSAP params, we can add motions paths
{
  duration: 1.5,           // Length of the animation in seconds
  x: 100,                  // Move element along X axis
  y: 50,                   // Move element along Y axis
  rotation: 360,           // Rotate element in degrees
  opacity: 0.5,            // Set transparency
  scale: 1.5,              // Scale the size uniformly
  ease: 'power2.out',      // Control easing type
  delay: 0.5,              // Wait before starting
  backgroundColor: "#ff0000", // Change background color
  onComplete: () => console.log('Animation finished!'), // Callback when animation completes
  onUpdate: () => console.log('Animating...'), // Callback during each animation frame
  transformOrigin: "50% 50%", // Set the origin point for transformations
  repeat: 2,               // Number of times to repeat
  yoyo: true,              // Reverse back to start after completing
  stagger: 0.2,            // Animate multiple elements staggered
  autoAlpha: 0             // Combine opacity and visibility
  ease: (t) => Math.pow(Math.E, -t)
  motionPath: {
    path: "#flightPath",    // Animation path for the movement
    align: "#terrainPath",  // Align to a different path (for visual consistency)
    autoRotate: true        // Make the drone rotate based on the alignment path
  },
}

**/

export class Button {
    /**
     * @param {Object} state - The centralized state object.
     * @param {string} property - The state property this button affects.
     * @param {string|HTMLElement} label - The label to display on the button.
     * @param {Object} options - Additional button options.
     *  - `width`: The width of the button.
     *  - `disabled`: Whether the button is disabled; defaults to false.
     */
    constructor(state, property, label = "Click Me", options = {}) {
        this.state = state;
        this.property = property;

        const {
            width = null,
            disabled = false
        } = options;

        // Create an Observable Input button
        this.element = Inputs.button(label, { disabled: disabled, width: width });

        // Handle button click to update the state
        this.element.addEventListener("click", () => {
            this.state.setProperty(this.property, !this.state.getProperty(this.property)); // Example: Toggle a boolean value
        });
    }
    /** 
    import { state } from './utils/state.js';
    import { Button } from './components/inputs/Button.js';
    
    // Set initial state for 'isButtonClicked'
    state.setProperty('isButtonClicked', false);
    
    // Create an instance of the Button class
    const buttonComponent = new Button(state, 'isButtonClicked', 'Toggle Value', {
      width: 100,
      disabled: false
    });
    
    // Append the button to the controls
    document.getElementById('controls').appendChild(buttonComponent.element);
    **/
}

export class Checkbox {
    /**
     * @param {Object} state - The centralized state object.
     * @param {string} property - The state property this checkbox controls.
     * @param {string} label - The label to display with the checkbox.
     * @param {Object} options - Additional checkbox options.
     *  - `disabled`: Whether the checkbox is disabled; defaults to false.
     */
    constructor(state, property, label = "Checkbox", options = {}) {
        this.state = state;
        this.property = property;

        const {
            disabled = false
        } = options;

        // Create an Observable Input checkbox
        this.element = Inputs.checkbox({ label: label, value: state.getProperty(property), disabled: disabled });

        // Handle checkbox change to update the state
        this.element.addEventListener("input", () => {
            this.state.setProperty(this.property, this.element.checked);
        });

        // Update the checkbox when state changes
        this.state.subscribe(this.property, (newValue) => {
            this.element.checked = newValue;
        });
    }
}

export class DateInput {
    /**
     * @param {Object} state - The centralized state object.
     * @param {string} property - The state property this date input controls.
     * @param {Object} options - Additional date input options.
     *  - `label`: A label to describe the date input.
     *  - `disabled`: Whether the date input is disabled; defaults to false.
     */
    constructor(state, property, options = {}) {
        this.state = state;
        this.property = property;

        const {
            label = "Select a date",
            disabled = false
        } = options;

        // Create an Observable Input date
        this.element = Inputs.date({ label: label, value: state.getProperty(property), disabled: disabled });

        // Handle date input change to update the state
        this.element.addEventListener("input", () => {
            this.state.setProperty(this.property, this.element.value);
        });

        // Update the date input when state changes
        this.state.subscribe(this.property, (newValue) => {
            this.element.value = newValue;
        });
    }
    /**import { state } from './utils/state.js';
import { DateInput } from './components/inputs/DateInput.js';

// Set initial value for 'selectedDate'
state.setProperty('selectedDate', new Date().toISOString().split('T')[0]);

// Create an instance of the DateInput class
const dateInputComponent = new DateInput(state, 'selectedDate', { label: "Choose Date" });

// Append the date input to the controls
document.getElementById('controls').appendChild(dateInputComponent.element);**/
}

export class Radio {
            /**
     * @param {Object} state - Centralized state object.
     * @param {string} property - State property to control.
     * @param {Array|Map} options - Options for the radio input.
     * @param {Object} params - Parameters for customization.
     */
    constructor(state, property, options = [], params = {}) {
        this.state = state;
        this.property = property;

        // Observable Input Radio
        this.element = Inputs.radio(options, {
            label: params.label || "Choose an option",
            value: state.getProperty(property),
            format: params.format || ((x) => x.label || x), // Correct label rendering
            disabled: params.disabled || false,
            sort: params.sort || false,
            unique: params.unique || false,
            keyof: (x) => x.label,  // Keys for display, this ensures options are tied
            valueof: (x) => x.value, // Ensure radio input uses correct option values
        });

        // Update state when user interacts
        this.element.addEventListener("input", () => {
            this.state.setProperty(this.property, this.element.value);
        });

        // Update UI when state changes externally
        this.state.subscribe(this.property, (newValue) => {
            this.element.value = newValue;
        });
    }

    /**
     * import { state } from './utils/state.js';
import { Radio } from './components/inputs/Radio.js';

// Set initial value for 'selectedOption'
state.setProperty('selectedOption', 'option1');

// Define options for the radio input
const radioOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' }
];

// Create an instance of the Radio class
const radioComponent = new Radio(state, 'selectedOption', radioOptions, "Choose an Option");

// Append the radio input to the controls
document.getElementById('controls').appendChild(radioComponent.element);
     */
}

export class Select {
    /**
     * @param {Object} state - The centralized state object.
     * @param {string} property - The state property this select dropdown controls.
     * @param {Array} options - The options for the select dropdown.
     *  - Each option can be a string or an object with `value` and `label`.
     * @param {string} label - The label to display with the select dropdown.
     */
    constructor(state, property, options = [], label = "Select an option") {
        this.state = state;
        this.property = property;

        // Create an Observable Input select dropdown
        this.element = Inputs.select(options, {
            label: label,
            value: state.getProperty(property),
        });

        // Handle select change to update the state
        this.element.addEventListener("input", () => {
            this.state.setProperty(this.property, this.element.value);
        });

        // Update the select input when state changes
        this.state.subscribe(this.property, (newValue) => {
            this.element.value = newValue;
        });
    }
    /**import { state } from './utils/state.js';
import { Select } from './components/inputs/Select.js';

// Set initial value for 'selectedItem'
state.setProperty('selectedItem', 'item1');

// Define options for the select input
const selectOptions = [
  { value: 'item1', label: 'Item 1' },
  { value: 'item2', label: 'Item 2' },
  { value: 'item3', label: 'Item 3' }
];

// Create an instance of the Select class
const selectComponent = new Select(state, 'selectedItem', selectOptions, "Select an Item");

// Append the select input to the controls
document.getElementById('controls').appendChild(selectComponent.element); */
}

export class Toggle {
    /**
     * @param {Object} state - The centralized state object.
     * @param {string} property - The state property this toggle controls.
     * @param {string|HTMLElement} label - The label to display with the toggle.
     * @param {Object} options - Additional toggle options.
     *  - `values`: The two values to toggle between; defaults to [true, false].
     *  - `value`: The initial value; defaults to the second value of `values`.
     *  - `disabled`: Whether the toggle is disabled; defaults to false.
     */
    constructor(state, property, label = "Toggle", options = {}) {
        this.state = state;
        this.property = property;

        // Destructure options with default values
        const {
            values = [true, false],
            value = values[1], // Defaults to the second value (i.e., false by default)
            disabled = false
        } = options;

        // Create an Observable Input toggle with the given options
        this.element = Inputs.toggle({
            label: label,
            //values: values,
            value: state.getProperty(property),
            disabled: options.disabled || false,
        });

        // Handle the toggle change and update the state
        this.element.addEventListener("input", () => {
            const newValue = this.element.checked ? values[0] : values[1];
            this.state.setProperty(this.property, newValue); // Update state when toggle changes
        });

        // Update the toggle when state changes externally
        this.state.subscribe(this.property, (newValue) => {
            this.element.checked = newValue; // Synchronize the checkbox
            this.element.value = newValue; // Synchronize the checkbox
          })

    }
    /**
     * import { state } from './utils/state.js';
import { Toggle } from './components/inputs/Toggle.js';

// Set initial value for 'isToggled'
state.setProperty('isToggled', false);

// Create an instance of the Toggle class
const toggleComponent = new Toggle(state, 'isToggled', 'Enable Option');

// Append the toggle to the controls
document.getElementById('controls').appendChild(toggleComponent.element);
     */
}

export class Slider {
    /**
     * @param {Object} state - The centralized state object.
     * @param {string} property - The state property this slider controls.
     * @param {number} min - The minimum value of the slider.
     * @param {number} max - The maximum value of the slider.
     * @param {number} initialValue - The initial value of the slider.
     * @param {string|HTMLElement} label - The label to display with the slider (can be a string or HTML element).
     * @param {number} step - The step value of the slider.
     * @param {Object} options - Additional slider options.
     *  - `format`: A format function; defaults to formatTrim.
     *  - `placeholder`: A placeholder string for when the input is empty.
     *  - `transform`: An optional non-linear transform function.
     *  - `invert`: The inverse of the transform function.
     *  - `validate`: A function to check whether the input value is valid.
     *  - `width`: The width of the input (not including the label).
     *  - `disabled`: Whether input is disabled; defaults to false.
     */

    constructor(state, property, min = 0, max = 100, initialValue = 50, label = "", step = 1, options = {}) {
        this.state = state;
        this.property = property;

        // Destructure the options parameter with default values set
        const {
            placeholder = null,
            width = null,
            disabled = false
        } = options;

        // Create an Observable Input slider using range() with extended parameters
        this.element = Inputs.range([min, max], {
            step: step,
            value: initialValue,
            label: label,
            placeholder: placeholder,
            width: width,
            disabled: disabled,
        });

        //calculate things
        
        // Update the centralized state when the slider value changes
        this.element.addEventListener("input", () => {
            this.state.setProperty(this.property, this.element.value);
            //this.state.setProperty(`${label}_current`, this.element.value)
        });

        
    }
}
