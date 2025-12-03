import Knob from "./general_components/Knob";
import Slider from "./general_components/Slider";
import { useState } from "react";

export default function ShowKnobs() {
  const [value1, setValue1] = useState(70);
  const [value2, setValue2] = useState(50);
  const [value3, setValue3] = useState(70);
  const [value4, setValue4] = useState(70);
  const [value5, setValue5] = useState(70);
  const [value6, setValue6] = useState(70);
  const [value7, setValue7] = useState(70);


  const logValue = (value) => {
    console.log("Slider value:", value);
  };

  return (
    
    <div className="show-knobs-container">
      <Knob value={value1} onChange={setValue1} />
     
      <Slider
        value={10}         // initial value (0–100)
        onChange={logValue} // callback returns 0–100 (linear or log depending on dB)
        dB={true}         // if true → logarithmic mapping
        min={-15}
        max={+15}
        center={true}
        />


   </div>
  );
}
