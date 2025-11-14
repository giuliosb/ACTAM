import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

// import del componente Keyboard
import Keyboard from "./components/Keyboard";

function App() {
  return (
    <>
      

      {/* Inseriamo la tastiera */}
      <Keyboard />
    </>
  );
}

export default App;
