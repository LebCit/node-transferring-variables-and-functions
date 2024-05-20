import { parseHiddenJSON } from "./parseHiddenJSON.js"

// 3. Retrieve hidden JSON data from a DOM element, parse it, and remove the element from the DOM
const greeting = parseHiddenJSON("greeting")
const continents = parseHiddenJSON("continents")

// Get greeting heading element
const greetingHeading = document.getElementById("greeting-heading")

// Use the greeting function as the inner text of the greeting heading
greetingHeading.innerText = greeting

// Get the continents' list element
const continentsList = document.getElementById("continents-list")

// Display each continent as a list item in the continents' list
continents.forEach((continent) => {
	// Create a list item element for each continent
	let listItem = document.createElement("li")

	// Set the continent's name as the inner text of the created list item
	listItem.innerText = continent

	// Append the list item to the continents' list element
	continentsList.append(listItem)
})
