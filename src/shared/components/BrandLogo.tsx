import lightLogo from "../../assets/thaiteacher-light.png";
import darkLogo from "../../assets/thaiteacher-dark.png";

export default function BrandLogo({ className = "" }: { className?: string }) {
  return <>
    <img src={lightLogo} alt="ThaiTeacher ให้ทุกวันของครูง่ายขึ้น" className={`block dark:hidden ${className}`} />
    <img src={darkLogo} alt="ThaiTeacher ให้ทุกวันของครูง่ายขึ้น" className={`hidden dark:block ${className}`} />
  </>;
}
