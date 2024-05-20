/*
 * Retrieves hidden JSON data from a DOM element, parses it, and removes the element from the DOM.
 * @param {string} elementId - The ID of the DOM element containing the hidden JSON data.
 * @returns {Object|null} - The parsed JSON data, or null if the element is not found.
 */
export const parseHiddenJSON = (elementId) => {
	// Retrieve the DOM element with the given ID
	const element = document.getElementById(elementId)

	// If the element is found
	if (element) {
		// Extract the JSON data from the text content of the element
		const dataText = element.textContent
		// Parse the JSON data
		const data = JSON.parse(dataText)
		// Remove the element from the DOM
		element.remove()
		// Return the parsed JSON data
		return data
	} else {
		// Log an error if the element is not found
		console.error(`Element with ID '${elementId}' not found.`)
		// Return null
		return null
	}
}
