import { useState } from "react"
import { Sample } from "../wailsjs/go/main/App"
import { Button } from "./components/ui/button"


function App() {
    const [result, setResult] = useState("")

    async function handleSample() {
        const response = await Sample("Sample function works!")
        setResult(response)
    }
    
    return (
        <div className="w-screen h-screen bg-amber-50 grid place-items-center">
            <Button variant="outline" onClick={handleSample}>Test Sample</Button>
            <p>{result}</p>
        </div>
    )
}

export default App
