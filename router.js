// Import the built-in HTTP server module
import { createServer as _createServer } from "node:http"

/**
 * Router class representing a router for handling HTTP requests.
 */
class Router {
	constructor() {
		// Initialize the root node of the routing tree
		this.rootNode = new RouteNode()
		// Initialize handlers for not found routes and errors
		this.notFoundHandler = null
		this.errorHandler = null
		// Stack to hold middleware functions
		this.middlewareStack = []
	}

	/**
	 * Generates nested routes recursively based on the provided prefix and router
	 * @param {RouteNode} currentNode - The current node in the routing tree
	 * @param {string} currentPrefix - The current prefix for the nested routes
	 * @param {Router} newRouter - The router containing the nested routes
	 */
	#generateNestedRoutes(currentNode, currentPrefix, newRouter) {
		// Iterate over handler methods and add them to the new router
		for (const [method, handler] of Object.entries(currentNode.handler)) {
			newRouter.addRoute(method, currentPrefix, handler)
		}

		// Iterate over child nodes and recursively generate nested routes
		for (const [pathSegment, subNode] of Object.entries(currentNode.children)) {
			this.#generateNestedRoutes(subNode, `${currentPrefix}/${pathSegment}`, newRouter)
		}

		// If the current node has a parameter, generate a route for it as well
		if (currentNode.param) {
			this.#generateNestedRoutes(currentNode.param, `${currentPrefix}/:${currentNode.param.paramName}`, newRouter)
		}
	}

	/**
	 * Adds a route to the router
	 * @param {string} httpMethod - The HTTP method (GET, POST, etc.)
	 * @param {string} routePath - The path of the route
	 * @param {function} requestHandler - The function to handle requests for this route
	 */
	addRoute(httpMethod, routePath, requestHandler) {
		let currentNode = this.rootNode
		let pathStart = 1,
			pathEnd = 1,
			pathLength = routePath.length

		// Loop through each character in the path
		for (; pathEnd <= pathLength; ++pathEnd) {
			if (pathEnd === pathLength || routePath[pathEnd] === "/") {
				let pathSegment = routePath.substring(pathStart, pathEnd)
				let nextNode

				// Check if the path segment starts with a colon, indicating a parameter
				if (pathSegment[0] === ":") {
					if (!currentNode.param) {
						currentNode.param = new RouteNode()
						currentNode.param.paramName = pathSegment.substring(1)
					}
					nextNode = currentNode.param
				} else {
					// Otherwise, try to find the child node with the current path segment
					nextNode =
						currentNode.children[pathSegment] || (currentNode.children[pathSegment] = new RouteNode())
				}

				currentNode = nextNode
				pathStart = pathEnd + 1
			}
		}

		// Store the request handler for the final path segment and method
		currentNode.handler[httpMethod] = requestHandler
	}

	/**
	 * Merges nodes from another router recursively
	 * @param {RouteNode} currentNode - The current node in the current router
	 * @param {RouteNode} nodeToMerge - The node from the router to be merged
	 */
	#mergeNodes(currentNode, nodeToMerge) {
		// Merge handler methods
		for (const [method, handler] of Object.entries(nodeToMerge.handler)) {
			currentNode.handler[method] = handler
		}

		// Merge child nodes recursively
		for (const [pathSegment, subNode] of Object.entries(nodeToMerge.children)) {
			if (!currentNode.children[pathSegment]) {
				currentNode.children[pathSegment] = new RouteNode()
			}
			this.#mergeNodes(currentNode.children[pathSegment], subNode)
		}

		// Merge parameter nodes (if any)
		if (nodeToMerge.param) {
			if (!currentNode.param) {
				currentNode.param = new RouteNode()
				currentNode.param.paramName = nodeToMerge.param.paramName
			}
			this.#mergeNodes(currentNode.param, nodeToMerge.param)
		}
	}

	/**
	 * Prints a representation of the current routing tree to the console for debugging purposes.
	 *
	 * This method recursively traverses the routing tree starting from the root node and
	 * prints information about each node, including its prefix, HTTP methods and handlers,
	 * and child nodes (including parameters).
	 */
	printTree() {
		this.#printNode(this.rootNode, "Root")
	}

	/**
	 * Helper function for recursively printing a node and its descendants in the routing tree.
	 *
	 * @param {RouteNode} node - The node to be printed
	 * @param {string} prefix - The prefix for the current node in the tree
	 * @param {number} level - The indentation level for the current node
	 * @param {string} prefixSymbol - The symbol to use for the current node (e.g., "├─" for children, "└─" for last child)
	 */
	#printNode(node, prefix, level = 0, prefixSymbol = "") {
		let indentation = " ".repeat(level * 4)

		// Print the node's prefix and any existing handlers:
		console.log(`${prefixSymbol ? `${indentation}${prefixSymbol} ${prefix || "/"}` : prefix}`)
		for (const [method, handler] of Object.entries(node.handler)) {
			const handlerName =
				handler.name ||
				handler
					.toString()
					.replace(/[\n]/g, "")
					.replace(/[\s]{2,}/g, " ")
					.substring(0, 30) + "..."
			console.log(`${indentation}  └─ [${method}] ↠  ${handlerName}`)
		}

		// Recursively print child nodes and the parameterized child (if any):
		for (const [childPrefix, childNode] of Object.entries(node.children)) {
			this.#printNode(childNode, childPrefix, level + 1, "├─")
		}
		if (node.param) {
			this.#printNode(node.param, `:${node.param.paramName}`, level + 1, "├─")
		}
	}

	/**
	 * Sets a custom not found handler function
	 * @param {function} handler - The function to handle requests for non-existent routes
	 */
	notFound(handler) {
		// Set up a custom not found handler
		this.notFoundHandler = handler
	}

	/**
	 * Sets a custom error handler function
	 * @param {function} handler - The function to handle unexpected errors
	 */
	onError(handler) {
		// Set up a custom error handler
		this.errorHandler = handler
	}

	/**
	 * Handles an incoming HTTP request and routes it to the appropriate handler.
	 *
	 * This method is the core of the routing logic. It performs the following steps:
	 *
	 * 1. Applies middleware functions to the request and response.
	 * 2. Extracts the HTTP method and route path from the request.
	 * 3. Finds a matching route handler using the #findRouteHandler method.
	 * 4. If a route handler is found:
	 *   a. Populates the `nativeReq.params` object with extracted parameters.
	 *   b. Creates a `nativeReq.queryParams` object for query parameters.
	 *   c. Invokes the route handler function with the request and response objects.
	 * 5. If a route handler is not found, either calls a custom notFound handler or sends a 404 response.
	 * 6. Catches any errors that occur during request handling and either calls a custom onError handler or sends a 500 response.
	 *
	 * @param {http.IncomingMessage} nativeReq - The incoming HTTP request object
	 * @param {http.ServerResponse} nativeRes - The outgoing HTTP response object
	 */
	async handleRequest(nativeReq, nativeRes) {
		try {
			// Apply middleware to the request and response
			await this.applyMiddleware(nativeReq, nativeRes)

			// Extract HTTP method and route path
			const { method, url } = nativeReq
			const queryDelimiter = url.indexOf("?")
			const routePath = queryDelimiter === -1 ? url : url.substring(0, queryDelimiter)

			// Find a matching route handler
			const routeHandler = this.#findRouteHandler(method, routePath)

			if (!routeHandler) {
				// No route handler found:
				if (this.notFoundHandler) {
					// Call custom notFound handler if available
					await this.notFoundHandler(nativeReq, nativeRes)
					return
				} else {
					// Send 404 response (not found)
					nativeRes.writeHead(404)
					nativeRes.end("Route Not Found")
					return
				}
			}

			// Route handler found:
			nativeReq.params = routeHandler.extractedParams // Attach extracted parameters to the request
			nativeReq.queryParams = new URLSearchParams(queryDelimiter === -1 ? "" : url.substring(queryDelimiter)) // Create query parameters object

			const routeHandlerFunc = routeHandler.requestHandler[routePath] || routeHandler.requestHandler

			if (typeof routeHandlerFunc === "function") {
				// Invoke the route handler function
				await routeHandlerFunc(nativeReq, nativeRes)
			} else {
				// Invalid route handler: send 404 response
				nativeRes.writeHead(404)
				nativeRes.end("Route Not Found")
			}
		} catch (error) {
			// Error handling:
			console.error("Internal Server Error:", error)

			if (this.errorHandler) {
				// Call custom onError handler if available
				await this.errorHandler(error, nativeReq, nativeRes)
				return
			} else {
				// Send 500 response (internal server error)
				nativeRes.writeHead(500)
				nativeRes.end("Internal Server Error")
			}
		}
	}

	/**
	 * Applies all middleware functions in the stack to the request and response.
	 *
	 * This method iterates through the `middlewareStack` array and calls each
	 * middleware function with the `nativeReq` and `nativeRes` objects. Middleware
	 * functions can modify the request and response objects or short-circuit the
	 * request handling process by calling `next()` with an error object to trigger
	 * error handling.
	 *
	 * @param {http.IncomingMessage} nativeReq - The incoming HTTP request object
	 * @param {http.ServerResponse} nativeRes - The outgoing HTTP response object
	 */
	async applyMiddleware(nativeReq, nativeRes) {
		for (const middleware of this.middlewareStack) {
			await middleware(nativeReq, nativeRes)
		}
	}

	/**
	 * Finds the handler for a specific HTTP method and route path.
	 *
	 * This method traverses the routing tree, starting from the root node, and
	 * attempts to match the path segments in the `routePath` with nodes in the tree.
	 * It also extracts any dynamic parameters from the path and stores them in the
	 * `extractedParams` object.
	 *
	 * @param {string} httpMethod - The HTTP method of the request
	 * @param {string} routePath - The path of the request
	 * @returns {object|null} - An object containing the handler and extracted parameters,
	 *                       or null if no matching handler is found
	 */
	#findRouteHandler(httpMethod, routePath) {
		let currentNode = this.rootNode // Start at the root node of the routing tree
		let extractedParams = Object.create(null) // Object to store extracted parameters
		let pathStart = 1 // Start parsing path segments from position 1 (after initial slash)
		const pathLength = routePath.length
		const stack = [] // Stack for backtracking during path traversal

		/**
		 * Iterates through the path segments in the `routePath` and attempts to match them
		 * with nodes in the routing tree.
		 *
		 * This loop performs the following steps for each path segment:
		 *
		 * 1. Extracts the path segment from the `routePath`.
		 * 2. Tries to find a child node in the current node with the matching path segment name.
		 * 3. If no child node is found and the current node has a parameter, attempts to use
		 *    the parameter to match the path segment.
		 * 4. If a matching node is found, updates the `currentNode`, extracted parameters (`extractedParams`),
		 *    and pushes the current state onto a stack for backtracking purposes.
		 * 5. If no matching node is found after checking both child nodes and the parameter,
		 *    returns `null` indicating no matching route was found.
		 *
		 * @param {string} routePath - The path of the request
		 * @returns {object|null} - An object containing the handler and extracted parameters,
		 *                       or null if no matching handler is found
		 */
		for (let pathEnd = 1; pathEnd <= pathLength; ++pathEnd) {
			if (pathEnd === pathLength || routePath[pathEnd] === "/") {
				const pathSegment = routePath.substring(pathStart, pathEnd)
				let nextNode = currentNode.children[pathSegment]

				// Handle dynamic parameters (colon-prefixed segments):
				while (!nextNode && currentNode.param) {
					nextNode = currentNode.param
					extractedParams[currentNode.param.paramName] = pathSegment // Extract parameter value
					pathStart = pathEnd + 1 // Move to the next path segment
				}

				if (!nextNode) return null // No matching route found

				stack.push({ node: nextNode, param: extractedParams }) // Store state for backtracking

				currentNode = nextNode
				pathStart = pathEnd + 1
			}
		}

		/**
		 * Checks for a matching handler for the given HTTP method and returns a result object.
		 *
		 * @param {string} httpMethod - The HTTP method of the request
		 * @returns {object|null} - An object containing the handler and extracted parameters,
		 *                       or null if no matching handler is found
		 */
		if (!currentNode.handler[httpMethod]) return null

		// Return the handler and extracted parameters if a match is found:
		return { requestHandler: currentNode.handler[httpMethod], extractedParams }
	}

	/**
	 * Adds a GET method to the router
	 * @param {string} routePath - The path of the route
	 * @param {function} requestHandler - The function to handle GET requests to this route
	 * @returns {Router} - The current router instance for chaining
	 */
	get(routePath, requestHandler) {
		this.addRoute("GET", routePath, requestHandler)
		return this
	}

	/**
	 * Adds a POST method to the router with improved error handling, request size limit, and content-type checking
	 * @param {string} routePath - The path of the route
	 * @param {function} requestHandler - The function to handle POST requests to this route
	 * @param {number} [maxRequestSize] - Maximum size of the request body in bytes (optional)
	 * @returns {Router} - The current router instance for chaining
	 */
	post(routePath, requestHandler, maxRequestSize = 1048576) {
		// Default max request size: 1MB
		const handler = async (req, res) => {
			let body = ""
			let contentType = req.headers["content-type"]

			// Check Content-Type header
			if (!/^application\/json/.test(contentType)) {
				return res.status(415).send("Unsupported Media Type")
			}

			// Limit request size
			if (req.headers["content-length"] > maxRequestSize) {
				return res.status(413).send("Request Entity Too Large")
			}

			// Collect the request body data
			req.on("data", (chunk) => {
				body += chunk.toString() // Convert Buffer to string
				if (body.length > maxRequestSize) {
					// Request size exceeds the limit, abort
					req.connection.destroy()
				}
			})

			// When the request body has been fully received
			req.on("end", async () => {
				try {
					// Parse the JSON body
					const data = JSON.parse(body) // Assuming JSON body

					// Call the provided request handler with the request, response, and parsed body
					await requestHandler(req, res, data)
				} catch (error) {
					// If there's an error parsing JSON, send a 400 response
					console.error("Error parsing JSON:", error)
					res.status(400).send("Invalid JSON")
				}
			})
		}

		// Add the POST route to the router with the defined handler
		this.addRoute("POST", routePath, handler)
		return this // Return the current router instance for chaining
	}

	/**
	 * Adds a PUT method to the router
	 * @param {string} routePath - The path of the route
	 * @param {function} requestHandler - The function to handle GET requests to this route
	 * @returns {Router} - The current router instance for chaining
	 */
	put(routePath, requestHandler) {
		this.addRoute("PUT", routePath, requestHandler)
		return this
	}

	/**
	 * Adds a DELETE method to the router
	 * @param {string} routePath - The path of the route
	 * @param {function} requestHandler - The function to handle GET requests to this route
	 * @returns {Router} - The current router instance for chaining
	 */
	delete(routePath, requestHandler) {
		this.addRoute("DELETE", routePath, requestHandler)
		return this
	}

	/**
	 * Adds a PATCH method to the router
	 * @param {string} routePath - The path of the route
	 * @param {function} requestHandler - The function to handle GET requests to this route
	 * @returns {Router} - The current router instance for chaining
	 */
	patch(routePath, requestHandler) {
		this.addRoute("PATCH", routePath, requestHandler)
		return this
	}

	/**
	 * Merges the routes from another router into this router's routing tree.
	 *
	 * This method performs a recursive merge, starting from the root nodes of both
	 * routing trees. It traverses the tree structures and combines routes and handlers
	 * while preserving any existing routes in the current router.
	 *
	 * @param {Router} routerToMerge - The router object containing the routes to merge
	 */
	merge(routerToMerge) {
		this.#mergeNodes(this.rootNode, routerToMerge.rootNode)
	}

	/**
	 * Nests the routes from another router under a specific prefix in the current router.
	 *
	 * This method creates a new temporary router, generates nested routes from the
	 * provided router under the specified prefix, and then merges the nested routes
	 * into the current router's tree.
	 *
	 * @param {string} prefix - The prefix to be prepended to the nested routes
	 * @param {Router} routerToNest - The router object containing the routes to be nested
	 * @returns {Router} - The current router instance for chaining
	 */
	nest(prefix, routerToNest) {
		this.#nestNodes(this.rootNode, routerToNest.rootNode, prefix)
		return this
	}

	/**
	 * Helper function for nesting routes from another router.
	 *
	 * @param {RouteNode} currentNode - The current node in the current router's tree
	 * @param {RouteNode} nodeToNest - The root node of the router to be nested
	 * @param {string} prefix - The prefix to be prepended to the nested routes
	 */
	#nestNodes(currentNode, nodeToNest, prefix) {
		const newRouter = new Router()
		this.#generateNestedRoutes(nodeToNest, prefix, newRouter)
		this.#mergeNodes(currentNode, newRouter.rootNode)
	}
}

/**
 * Represents a node in the routing tree.
 *
 * This class serves as the building block for the router's internal structure,
 * storing information about routes, handlers, child nodes, and parameters.
 */
class RouteNode {
	/**
	 * Creates a new RouteNode instance.
	 *
	 * This constructor initializes the node's properties with empty objects or null values:
	 *
	 * - `handler`: An object to store handlers for different HTTP methods (e.g., GET, POST).
	 * - `children`: An object to store child nodes representing nested routes.
	 * - `param`: A reference to a child node representing a dynamic parameter segment.
	 * - `paramName`: The name of the dynamic parameter, if applicable.
	 */
	constructor() {
		this.handler = Object.create(null) // Empty object for handlers
		this.children = Object.create(null) // Empty object for child nodes
		this.param = null // Initially no dynamic parameter
		this.paramName = null // Initially no parameter name
	}
}

/**
 * Creates an HTTP server instance and attaches the provided router to handle incoming requests.
 *
 * This function utilizes the underlying `_createServer` function, which likely encapsulates
 * the actual server creation logic. It then wraps the router's `handleRequest` method in a
 * callback function and passes it to `_createServer`. This way, whenever a request arrives,
 * the router's `handleRequest` method will be responsible for handling it.
 *
 * @param {Router} router - The router object to handle incoming requests
 * @returns {http.Server} - The created HTTP server instance
 */
function createServer(router) {
	return _createServer((req, res) => {
		router.handleRequest(req, res)
	})
}

export { Router, createServer }
