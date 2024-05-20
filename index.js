import { Eta } from "eta"
import { join } from "path"
import { createServer, Router } from "./router.js"
import { staticAssetLoader } from "./staticAssetLoader.js"

const app = new Router()
// Define the views folder as the root of Eta's templates
const eta = new Eta({ views: join(process.cwd(), "views") })

// Serve static assets from default folder "static"
staticAssetLoader.serveStaticAssets(app)

// Define an array to be transferred
const continentsArray = ["Africa", "Antarctica", "Asia", "Australia", "Europe", "North America", "South America"]

// Define a function to be transferred
const greetingFunction = () => {
	const greetingString = "Server says hello to Client!"
	return greetingString
}

// 1. Render a template with a data object on a route
app.get("/", (req, res) => {
	const response = eta.render("index.html", {
		continents: continentsArray,
		greeting: greetingFunction,
	})
	res.writeHead(200, { "Content-Type": "text/html" })
	res.end(response)
})

createServer(app).listen(5000, () => {
	console.log(`App @ http://localhost:${5000}`)
})
