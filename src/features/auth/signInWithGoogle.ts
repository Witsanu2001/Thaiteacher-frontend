import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth } from "../../config/firebase";
export async function signInWithGoogle() {
 const provider = new GoogleAuthProvider();
 provider.setCustomParameters({ prompt: "select_account" });
 const isIPadOrIPhone = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
 if (isIPadOrIPhone && window.location.hostname === "thaiteacher-app.web.app") await signInWithRedirect(auth, provider);
 else await signInWithPopup(auth, provider);
}
