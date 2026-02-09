import { useEffect, useMemo, useState } from "react";
import switchImg from "../../assets/images/switch.png";
import switchRotatedImg from "../../assets/images/switch_rot.png";
import switchInner from "../../assets/images/switch_inner.png";
import switchAudio from "../../assets/sound_effects/switch_audio.wav";

export default function Switch({ horizontal = false, size = 100, onToggle, disabled=false}) {
  const [flipped, setFlipped] = useState(false);
  const innerAudio = useMemo(() => {
    if (!switchAudio) {
      return null;
    }
    const instance = new Audio(switchAudio);
    instance.preload = "auto";
    instance.volume = 0.2; // Volume of the switch sound
    return instance;
  }, [switchAudio]);

  const handleClick = () => {
    if (disabled) {
      return;
    }
    setFlipped((prev) => !prev);
    if (!innerAudio) {
      return;
    }
    innerAudio.currentTime = 0;
    innerAudio.play().catch(() => {});
    if (onToggle) {
      onToggle();
    }
  };

  useEffect(() => {
    return () => {
      innerAudio?.pause();
      if (innerAudio) {
        innerAudio.currentTime = 0;
      }
    };
  }, [innerAudio]);

  return (
    <div
      onClick={handleClick}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-block",
        cursor: disabled ? "not-allowed" : "pointer",
        transform: horizontal ? "rotate(-90deg)" : undefined,
        transformOrigin: "center center",
      }}
    >
      <img
        src={horizontal ? switchRotatedImg : switchImg}
        alt="Switch"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <div
        style={{
          position: "absolute",
          top: horizontal ? "50%" : "48%",
          left: horizontal ? "51%" : "50%",
          width: "59%",
          height: "65%",
          transform: `translate(-50%, -50%) rotate(${flipped ? 180 : 0}deg)`,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={switchInner}
          alt="Switch inner"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
          }}
        />
      </div>
    </div>
  );
}

