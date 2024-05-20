// Import necessary functions from the 'fs' module
import { readFileSync, readdirSync, statSync } from "fs"

// Import the 'path' module for path manipulation
import path from "path"

/**
 * StaticAssetLoader class for serving static assets from a directory.
 */
class StaticAssetLoader {
	/**
	 * Constructor for StaticAssetLoader class.
	 */
	constructor() {
		this.directory = "static" // Default directory
		this.staticAssets = this.getFiles(this.directory)
	}

	/**
	 * Method to get files from their directory recursively.
	 * @param {string} dirName - The directory path.
	 * @returns {string[]} - Array of file paths.
	 */
	getFiles(dirName) {
		let files = []
		const items = readdirSync(dirName, { withFileTypes: true })

		for (const item of items) {
			if (item.isDirectory()) {
				files = [...files, ...this.getFiles(`${dirName}/${item.name}`)]
			} else {
				files.push(`${dirName}/${item.name}`)
			}
		}

		return files
	}

	/**
	 * Method to determine content type based on file extension.
	 * @param {string} file - The file path.
	 * @returns {string} - The content type.
	 */
	getContentType(file) {
		const extname = path.extname(file)
		switch (extname) {
			case ".css":
				return "text/css"
			case ".js":
			case ".mjs":
				return "application/javascript"
			case ".png":
				return "image/png"
			case ".jpg":
			case ".jpeg":
				return "image/jpeg"
			case ".gif":
				return "image/gif"
			case ".avif":
				return "image/avif"
			case ".svg":
				return "image/svg+xml"
			case ".ico":
				return "image/x-icon"
			case ".webp":
				return "image/webp"
			default:
				return "application/octet-stream" // Default to binary data if the content type is not recognized
		}
	}

	/**
	 * Method to serve static assets using Router app.
	 * @param {object} app - The Router app instance.
	 * @param {string} [directory="static"] - The directory containing static assets.
	 */
	serveStaticAssets(app, directory = "static") {
		const staticAssets = this.getFiles(directory)

		staticAssets.forEach((el) => {
			app.get(`/${el}`, (req, res) => {
				const filePath = path.join(process.cwd(), `/${el}`)

				try {
					const stats = statSync(filePath)
					if (stats.isFile()) {
						const contentType = this.getContentType(filePath)
						res.setHeader("Content-Type", contentType)

						const fileContents = readFileSync(filePath)
						res.end(fileContents)
					} else {
						// If it's not a file, send a 404 Not Found response.
						res.end("Not Found")
					}
				} catch (err) {
					console.error(`Error while serving file: ${err.message}`)

					res.writeHead(302, { Location: "/500" })
					res.end()
					return
				}
			})
		})
	}
}

export const staticAssetLoader = new StaticAssetLoader()
