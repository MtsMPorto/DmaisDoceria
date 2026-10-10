import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ProductsProvider } from "@/contexts/ProductsContext";
import { CartProvider } from "@/contexts/CartContext";

export default function App() {
  useEffect(() => {
    // viewport-fit=cover must be in the original HTML to take effect in Safari.
    // As a fallback, detect notch iPhones via JS and set a CSS var for hardcoded safe-area padding.
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);
    const hasNotch = isIOS && window.screen.height >= 812;
    const satFallback = hasNotch
      ? window.screen.height >= 900
        ? "59px"
        : "50px"
      : "0px";
    document.documentElement.style.setProperty(
      "--sat-fallback",
      satFallback,
    );
  }, []);

  return (
    <ProductsProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </ProductsProvider>
  );
}