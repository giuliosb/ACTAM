import { useState } from "react";
import "./Indicator.css";

export default function Indicator({ on }) {
  return <div className={`indicatorlight ${on ? "on" : ""}`} />;
}
