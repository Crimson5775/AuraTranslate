import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeftRight, 
  Volume2, 
  Settings, 
  X, 
  Search, 
  Check, 
  Sparkles, 
  Copy, 
  CornerDownLeft, 
  ChevronDown, 
  Trash2,
  AlertCircle,
  Keyboard,
  Sliders,
  LogOut,
  Minus,
  Square
} from "lucide-react";
import { 
  LANGUAGE_MAP, 
  translateWithGoogle, 
  translateWithAppsScript, 
  translateWithGemini,
  detectLanguage
} from "./translationService";

// Helper to compare shortcut strings with KeyDown Events
const matchShortcut = (e, shortcutStr, heldModifiers) => {
  if (!shortcutStr) return false;
  
  const parts = shortcutStr.split("+");
  const targetCode = parts[parts.length - 1]; // e.g. "KeyM" or "Space"
  
  // Normalize comparisons
  const normTarget = targetCode.toLowerCase();
  const normCode = e.code.toLowerCase();
  const normKey = e.key.toLowerCase();
  
  let isKeyMatch = false;
  if (normCode === normTarget) {
    isKeyMatch = true;
  } else if (normCode === ("key" + normTarget)) {
    isKeyMatch = true;
  } else if (normCode === ("digit" + normTarget)) {
    isKeyMatch = true;
  } else if (normKey === normTarget || (normTarget === "space" && normKey === " ")) {
    isKeyMatch = true;
  }
  
  if (!isKeyMatch) return false;

  // Modifiers required by the shortcut string
  const hasCtrl = parts.includes("Control") || parts.includes("ControlLeft") || parts.includes("ControlRight");
  const hasShift = parts.includes("Shift") || parts.includes("ShiftLeft") || parts.includes("ShiftRight");
  const hasAlt = parts.includes("Alt") || parts.includes("AltLeft") || parts.includes("AltRight");
  const hasMeta = parts.includes("Super") || parts.includes("MetaLeft") || parts.includes("MetaRight") || parts.includes("Meta");

  // Verify event modifier states
  if (hasCtrl !== e.ctrlKey) return false;
  if (hasShift !== e.shiftKey) return false;
  if (hasAlt !== e.altKey) return false;
  if (hasMeta !== e.metaKey) return false;

  // If Left/Right specific modifiers are in the shortcut, verify they match held modifiers
  if (heldModifiers) {
    if (parts.includes("ControlLeft") && !heldModifiers.ControlLeft) return false;
    if (parts.includes("ControlRight") && !heldModifiers.ControlRight) return false;
    if (parts.includes("ShiftLeft") && !heldModifiers.ShiftLeft) return false;
    if (parts.includes("ShiftRight") && !heldModifiers.ShiftRight) return false;
    if (parts.includes("AltLeft") && !heldModifiers.AltLeft) return false;
    if (parts.includes("AltRight") && !heldModifiers.AltRight) return false;
    if (parts.includes("MetaLeft") && !heldModifiers.MetaLeft) return false;
    if (parts.includes("MetaRight") && !heldModifiers.MetaRight) return false;
  }

  return true;
};

// Helper to format shortcut strings into nice keycaps array
const renderKeycaps = (shortcutStr) => {
  if (!shortcutStr) return null;
  return shortcutStr.split("+").map(part => {
    let display = part;
    if (display === "ControlLeft") display = "L-Ctrl";
    if (display === "ControlRight") display = "R-Ctrl";
    if (display === "AltLeft") display = "L-Alt";
    if (display === "AltRight") display = "R-Alt";
    if (display === "ShiftLeft") display = "L-Shift";
    if (display === "ShiftRight") display = "R-Shift";
    if (display === "MetaLeft") display = "L-Win";
    if (display === "MetaRight") display = "R-Win";
    if (display === "Control") display = "Ctrl";
    if (display === "Shift") display = "Shift";
    if (display === "Alt") display = "Alt";
    if (display === "Super") display = "Win";
    if (display.startsWith("Key")) display = display.substring(3);
    if (display.startsWith("Digit")) display = display.substring(5);
    return <span key={part} className="key-cap">{display}</span>;
  });
};

// Helper to format shortcut display string inside readOnly inputs
const formatShortcutDisplay = (shortcutStr) => {
  if (!shortcutStr) return "";
  return shortcutStr
    .replace(/ControlLeft/g, "L-Ctrl")
    .replace(/ControlRight/g, "R-Ctrl")
    .replace(/AltLeft/g, "L-Alt")
    .replace(/AltRight/g, "R-Alt")
    .replace(/ShiftLeft/g, "L-Shift")
    .replace(/ShiftRight/g, "R-Shift")
    .replace(/MetaLeft/g, "L-Win")
    .replace(/MetaRight/g, "R-Win")
    .replace(/Control/g, "Ctrl")
    .replace(/Super/g, "Win")
    .replace(/Key/g, "")
    .replace(/Digit/g, "")
    .split("+")
    .join(" + ");
};

export default function App() {
  // --- State Variables ---
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState(() => localStorage.getItem("sourceLang") || "auto");
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem("targetLang") || "ar");
  const [provider, setProvider] = useState(() => localStorage.getItem("provider") || "google");
  
  // Custom theme settings
  const [theme, setTheme] = useState(() => localStorage.getItem("appTheme") || "dark");
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem("appOpacity");
    return saved !== null ? parseFloat(saved) : 0.75;
  });
  
  // API Keys / Settings
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("geminiKey") || "");
  const [appsScriptUrl, setAppsScriptUrl] = useState(() => 
    localStorage.getItem("appsScriptUrl") || ""
  );
  
  // Custom Shortcuts state
  const [shortcuts, setShortcuts] = useState(() => {
    const defaultShortcuts = {
      globalToggle: "Control+Shift+Space",
      copy: "Control+Enter",
      swap: "Alt+S",
      speakInput: "Alt+I",
      speakTranslation: "Alt+O",
      clear: "Escape"
    };
    const saved = localStorage.getItem("appShortcuts");
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        const merged = { ...defaultShortcuts, ...parsed };
        if (!merged.globalToggle) {
          merged.globalToggle = defaultShortcuts.globalToggle;
        }
        return merged;
      } catch (e) {}
    }
    return defaultShortcuts;
  });

  // Windows Startup state
  const [openAtStartup, setOpenAtStartup] = useState(false);

  // Hide on Blur state (default to true)
  const [hideOnBlur, setHideOnBlurState] = useState(() => {
    const saved = localStorage.getItem("hideOnBlur");
    return saved !== null ? saved === "true" : true;
  });
  const [tempHideOnBlur, setTempHideOnBlur] = useState(hideOnBlur);

  // Footer visibility state (fixed, hover, hidden)
  const [footerMode, setFooterMode] = useState(() => {
    return localStorage.getItem("footerMode") || "hover";
  });
  const [tempFooterMode, setTempFooterMode] = useState(footerMode);

  // First-time welcome tip
  const [showWelcomeTip, setShowWelcomeTip] = useState(() => {
    return localStorage.getItem("hasSeenFooterIntro") !== "true";
  });

  // Temp form states
  const [tempGeminiKey, setTempGeminiKey] = useState(geminiKey);
  const [tempAppsScriptUrl, setTempAppsScriptUrl] = useState(appsScriptUrl);
  const [tempShortcuts, setTempShortcuts] = useState(shortcuts);
  const [tempOpenAtStartup, setTempOpenAtStartup] = useState(openAtStartup);
  const [tempTheme, setTempTheme] = useState(theme);
  const [tempOpacity, setTempOpacity] = useState(opacity);

  // Status & UI States
  const [status, setStatus] = useState("idle"); // idle, translating, error
  const [errorMessage, setErrorMessage] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general"); // general, shortcuts
  const [recordingAction, setRecordingAction] = useState(null); // 'globalToggle', 'copy', etc.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Dropdowns
  const [activeDropdown, setActiveDropdown] = useState(null); // 'source', 'target', or null
  
  // Action Menu State
  const [menuQuery, setMenuQuery] = useState("");
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
  
  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  
  // Refs
  const inputRef = useRef(null);
  const menuSearchRef = useRef(null);
  const dropdownRef = useRef(null);

  const heldModifiersRef = useRef({
    ControlLeft: false,
    ControlRight: false,
    AltLeft: false,
    AltRight: false,
    ShiftLeft: false,
    ShiftRight: false,
    MetaLeft: false,
    MetaRight: false
  });

  // --- Electron Startup Integration ---
  useEffect(() => {
    if (window.electron) {
      // Get startup status from native system
      window.electron.getStartupStatus().then(status => {
        setOpenAtStartup(status);
        setTempOpenAtStartup(status);
      });

      // Set initial hide-on-blur state
      window.electron.setHideOnBlur(hideOnBlur);

      // Register initial global shortcut
      window.electron.setGlobalShortcut(shortcuts.globalToggle).then(success => {
        if (!success) {
          showToast("Global shortcut registration failed! It might be in use.");
        }
      });

      // Focus input when window shown
      window.electron.onFocusInput(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, []);

  // Apply theme-matching border color in Electron on load/change
  useEffect(() => {
    if (window.electron && typeof window.electron.setThemeBorder === "function") {
      window.electron.setThemeBorder(theme);
    }
  }, [theme]);

  // --- Track Modifier Keys State (Differentiating Left/Right) ---
  useEffect(() => {
    const updateModifierState = (e, isDown) => {
      if ([
        "ControlLeft", "ControlRight",
        "ShiftLeft", "ShiftRight",
        "AltLeft", "AltRight",
        "MetaLeft", "MetaRight"
      ].includes(e.code)) {
        heldModifiersRef.current[e.code] = isDown;
      }
    };

    const handleGlobalKeyDown = (e) => {
      updateModifierState(e, true);
    };

    const handleGlobalKeyUp = (e) => {
      updateModifierState(e, false);
    };

    const handleGlobalBlur = () => {
      // Clear modifier states on window blur to avoid stuck modifiers
      heldModifiersRef.current = {
        ControlLeft: false,
        ControlRight: false,
        AltLeft: false,
        AltRight: false,
        ShiftLeft: false,
        ShiftRight: false,
        MetaLeft: false,
        MetaRight: false
      };
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    window.addEventListener("keyup", handleGlobalKeyUp, true);
    window.addEventListener("blur", handleGlobalBlur);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
      window.removeEventListener("keyup", handleGlobalKeyUp, true);
      window.removeEventListener("blur", handleGlobalBlur);
    };
  }, []);

  // --- Persist Lang, Provider, Theme & Opacity ---
  useEffect(() => {
    localStorage.setItem("sourceLang", sourceLang);
  }, [sourceLang]);

  useEffect(() => {
    localStorage.setItem("targetLang", targetLang);
  }, [targetLang]);

  useEffect(() => {
    localStorage.setItem("provider", provider);
  }, [provider]);

  // --- Debounced Translation ---
  useEffect(() => {
    if (!inputText.trim()) {
      setTranslatedText("");
      setStatus("idle");
      setErrorMessage("");
      return;
    }

    setStatus("translating");
    setErrorMessage("");

    const delayDebounceFn = setTimeout(async () => {
      try {
        let result = "";
        if (provider === "google") {
          result = await translateWithGoogle(inputText, sourceLang, targetLang);
        } else if (provider === "appsScript") {
          result = await translateWithAppsScript(inputText, sourceLang, targetLang, appsScriptUrl);
        } else if (provider === "gemini") {
          result = await translateWithGemini(inputText, sourceLang, targetLang, geminiKey);
        }
        setTranslatedText(result);
        setStatus("idle");
      } catch (e) {
        console.error(e);
        setErrorMessage(e.message || "Translation failed.");
        setStatus("error");
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [inputText, sourceLang, targetLang, provider, appsScriptUrl, geminiKey]);

  // --- Clipboard Copy ---
  const copyTranslation = () => {
    if (!translatedText) {
      showToast("Nothing to copy!");
      return;
    }
    navigator.clipboard.writeText(translatedText)
      .then(() => {
        showToast("Translation copied!");
      })
      .catch((err) => {
        console.error("Clipboard copy failed: ", err);
        showToast("Failed to copy");
      });
  };

  // --- Text-To-Speech (TTS) ---
  const speakText = (text, langCode) => {
    if (!window.speechSynthesis) {
      showToast("Speech synthesis not supported in this browser");
      return;
    }
    
    window.speechSynthesis.cancel();
    if (!text) return;
    
    if (langCode === "auto") {
      setStatus("translating");
      detectLanguage(text).then(detected => {
        setStatus("idle");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = detected;
        window.speechSynthesis.speak(utterance);
      }).catch(e => {
        setStatus("error");
        console.error(e);
      });
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- Toast Manager ---
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  // --- Swap Languages ---
  const swapLanguages = () => {
    if (sourceLang === "auto") {
      if (!inputText) {
        showToast("Enter text first to detect and swap languages");
        return;
      }
      setStatus("translating");
      detectLanguage(inputText).then(detected => {
        setStatus("idle");
        setSourceLang(targetLang);
        setTargetLang(detected);
        setInputText(translatedText);
        setTranslatedText(inputText);
      }).catch(e => {
        setStatus("error");
        console.error(e);
      });
    } else {
      const tempSource = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(tempSource);
      setInputText(translatedText);
      setTranslatedText(inputText);
    }
  };

  // --- Clear Text ---
  const clearAllText = () => {
    setInputText("");
    setTranslatedText("");
    setStatus("idle");
    setErrorMessage("");
    if (inputRef.current) inputRef.current.focus();
  };

  // --- Save Settings ---
  const saveSettings = (e) => {
    e.preventDefault();
    
    // Validate that the global hotkey has at least one modifier key
    const parts = tempShortcuts.globalToggle ? tempShortcuts.globalToggle.split("+") : [];
    const hasModifier = parts.some(part => [
      "ControlLeft", "ControlRight", "Control",
      "ShiftLeft", "ShiftRight", "Shift",
      "AltLeft", "AltRight", "Alt",
      "MetaLeft", "MetaRight", "Meta", "Super"
    ].includes(part));
    
    let finalShortcuts = tempShortcuts;
    if (!hasModifier) {
      finalShortcuts = {
        ...tempShortcuts,
        globalToggle: shortcuts.globalToggle || "Control+Shift+Space"
      };
      setTempShortcuts(finalShortcuts);
    }
    
    setGeminiKey(tempGeminiKey);
    setAppsScriptUrl(tempAppsScriptUrl);
    setShortcuts(finalShortcuts);
    setOpenAtStartup(tempOpenAtStartup);
    setHideOnBlurState(tempHideOnBlur);
    setFooterMode(tempFooterMode);
    setTheme(tempTheme);
    setOpacity(tempOpacity);
    
    localStorage.setItem("geminiKey", tempGeminiKey);
    localStorage.setItem("appsScriptUrl", tempAppsScriptUrl);
    localStorage.setItem("appShortcuts", JSON.stringify(finalShortcuts));
    localStorage.setItem("hideOnBlur", tempHideOnBlur.toString());
    localStorage.setItem("footerMode", tempFooterMode);
    localStorage.setItem("appTheme", tempTheme);
    localStorage.setItem("appOpacity", tempOpacity.toString());
    
    if (window.electron) {
      window.electron.toggleStartup(tempOpenAtStartup);
      window.electron.setHideOnBlur(tempHideOnBlur);
      window.electron.setGlobalShortcut(finalShortcuts.globalToggle).then(success => {
        if (!success) {
          showToast("Global hotkey failed to register! It might be in use by another app.");
        } else {
          showToast("Settings saved!");
        }
      });
    } else {
      showToast("Settings saved!");
    }
    
    setIsSettingsOpen(false);
  };

  // --- Settings Defaults Close ---
  const closeSettingsModal = () => {
    setTempGeminiKey(geminiKey);
    setTempAppsScriptUrl(appsScriptUrl);
    setTempShortcuts(shortcuts);
    setTempOpenAtStartup(openAtStartup);
    setTempHideOnBlur(hideOnBlur);
    setTempFooterMode(footerMode);
    setTempTheme(theme);
    setTempOpacity(opacity);
    setRecordingAction(null);
    setIsSettingsOpen(false);
    if (window.electron) {
      window.electron.setHideOnBlur(hideOnBlur); // Restore hide-on-blur state
    }
  };

  const closeWelcomeTip = () => {
    localStorage.setItem("hasSeenFooterIntro", "true");
    setShowWelcomeTip(false);
  };

  // --- Keyboard Shortcuts Global Handler ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If user is recording a shortcut, let the recording input handle it exclusively
      if (recordingAction) return;

      // Escape key checks
      if (e.key === "Escape") {
        if (isSettingsOpen) {
          closeSettingsModal();
          e.preventDefault();
          return;
        } else if (isMenuOpen) {
          setIsMenuOpen(false);
          e.preventDefault();
          return;
        } else if (activeDropdown) {
          setActiveDropdown(null);
          e.preventDefault();
          return;
        }
      }

      // Action Menu toggle (Ctrl+K)
      if (e.ctrlKey && e.code === "KeyK") {
        e.preventDefault();
        if (isSettingsOpen) return;
        setIsMenuOpen(prev => !prev);
        return;
      }

      // Open Settings directly with Ctrl + ,
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Prevent key shortcuts while typing in active search/settings inputs
      if (isSettingsOpen || isMenuOpen) return;

      // Match custom app-level shortcuts
      if (matchShortcut(e, shortcuts.copy, heldModifiersRef.current)) {
        e.preventDefault();
        copyTranslation();
      } else if (matchShortcut(e, shortcuts.swap, heldModifiersRef.current)) {
        e.preventDefault();
        swapLanguages();
      } else if (matchShortcut(e, shortcuts.speakInput, heldModifiersRef.current)) {
        e.preventDefault();
        speakText(inputText, sourceLang);
      } else if (matchShortcut(e, shortcuts.speakTranslation, heldModifiersRef.current)) {
        e.preventDefault();
        speakText(translatedText, targetLang);
      } else if (matchShortcut(e, shortcuts.clear, heldModifiersRef.current)) {
        e.preventDefault();
        clearAllText();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen, isMenuOpen, activeDropdown, inputText, translatedText, sourceLang, targetLang, shortcuts, recordingAction]);

  // Focus inputs on open
  useEffect(() => {
    if (isMenuOpen && menuSearchRef.current) {
      menuSearchRef.current.focus();
      setMenuQuery("");
      setMenuSelectedIndex(0);
    } else if (!isMenuOpen && !isSettingsOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMenuOpen, isSettingsOpen]);

  // Click outside dropdowns to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Shortcut Recorder Handler ---
  const [recordingShortcutText, setRecordingShortcutText] = useState("");

  const startRecording = (actionKey) => {
    setRecordingAction(actionKey);
    setRecordingShortcutText("Press keys...");
    if (window.electron) {
      window.electron.setHideOnBlur(false); // Disable hide-on-blur while recording
    }
  };
  
  const stopRecording = () => {
    setRecordingAction(null);
    setRecordingShortcutText("");
    if (window.electron) {
      window.electron.setHideOnBlur(hideOnBlur); // Restore hide-on-blur state
    }
  };

  const handleRecordKeyDown = (e, actionKey) => {
    e.preventDefault();
    e.stopPropagation();

    const isModifier = [
      "ControlLeft", "ControlRight",
      "ShiftLeft", "ShiftRight",
      "AltLeft", "AltRight",
      "MetaLeft", "MetaRight"
    ].includes(e.code);

    const mods = [];
    if (heldModifiersRef.current.ControlLeft || e.code === "ControlLeft") mods.push("ControlLeft");
    if (heldModifiersRef.current.ControlRight || e.code === "ControlRight") mods.push("ControlRight");
    if (heldModifiersRef.current.ShiftLeft || e.code === "ShiftLeft") mods.push("ShiftLeft");
    if (heldModifiersRef.current.ShiftRight || e.code === "ShiftRight") mods.push("ShiftRight");
    if (heldModifiersRef.current.AltLeft || e.code === "AltLeft") mods.push("AltLeft");
    if (heldModifiersRef.current.AltRight || e.code === "AltRight") mods.push("AltRight");
    if (heldModifiersRef.current.MetaLeft || e.code === "MetaLeft") mods.push("MetaLeft");
    if (heldModifiersRef.current.MetaRight || e.code === "MetaRight") mods.push("MetaRight");

    if (isModifier) {
      if (mods.length > 0) {
        setRecordingShortcutText(mods.map(m => formatShortcutDisplay(m)).join(" + ") + " + ...");
      } else {
        setRecordingShortcutText("Press keys...");
      }
      return;
    }

    if (actionKey === "globalToggle" && mods.length === 0) {
      setRecordingShortcutText("Needs modifier (Ctrl/Alt/Shift/Win)!");
      return;
    }

    const parts = [...mods, e.code];
    const shortcutStr = parts.join("+");

    setTempShortcuts(prev => ({
      ...prev,
      [actionKey]: shortcutStr
    }));
    setRecordingAction(null);
    setRecordingShortcutText("");
    if (window.electron) {
      window.electron.setHideOnBlur(hideOnBlur); // Restore hide-on-blur state
    }
  };

  const handleRecordKeyUp = (e, actionKey) => {
    e.preventDefault();
    e.stopPropagation();

    const mods = [];
    if (heldModifiersRef.current.ControlLeft) mods.push("ControlLeft");
    if (heldModifiersRef.current.ControlRight) mods.push("ControlRight");
    if (heldModifiersRef.current.ShiftLeft) mods.push("ShiftLeft");
    if (heldModifiersRef.current.ShiftRight) mods.push("ShiftRight");
    if (heldModifiersRef.current.AltLeft) mods.push("AltLeft");
    if (heldModifiersRef.current.AltRight) mods.push("AltRight");
    if (heldModifiersRef.current.MetaLeft) mods.push("MetaLeft");
    if (heldModifiersRef.current.MetaRight) mods.push("MetaRight");

    if (mods.length > 0) {
      setRecordingShortcutText(mods.map(m => formatShortcutDisplay(m)).join(" + ") + " + ...");
    } else {
      setRecordingShortcutText("Press keys...");
    }
  };

  // --- Action Menu Items ---
  const menuItems = [
    { id: "swap", title: "Swap Languages", shortcut: renderKeycaps(shortcuts.swap), icon: ArrowLeftRight, action: () => { swapLanguages(); setIsMenuOpen(false); } },
    { id: "copy", title: "Copy Translation", shortcut: renderKeycaps(shortcuts.copy), icon: Copy, action: () => { copyTranslation(); setIsMenuOpen(false); } },
    { id: "speak_in", title: "Speak Input Text", shortcut: renderKeycaps(shortcuts.speakInput), icon: Volume2, action: () => { speakText(inputText, sourceLang); setIsMenuOpen(false); } },
    { id: "speak_out", title: "Speak Translation", shortcut: renderKeycaps(shortcuts.speakTranslation), icon: Volume2, action: () => { speakText(translatedText, targetLang); setIsMenuOpen(false); } },
    { id: "clear", title: "Clear All Text", shortcut: renderKeycaps(shortcuts.clear), icon: Trash2, action: () => { clearAllText(); setIsMenuOpen(false); } },
    { id: "settings", title: "Open Settings", shortcut: [<span key="meta" className="key-cap">Ctrl</span>, <span key="comma" className="key-cap">,</span>], icon: Settings, action: () => { setIsSettingsOpen(true); setIsMenuOpen(false); } },
    { 
      id: "quit", 
      title: "Quit AuraTranslate", 
      shortcut: [<span key="meta" className="key-cap">Alt</span>, <span key="f4" className="key-cap">F4</span>], 
      icon: LogOut, 
      action: () => { 
        if (window.electron) {
          window.electron.closeApp(); 
        } else {
          showToast("Quit not supported in browser mode");
        }
      },
      visibleOnlyInElectron: true
    },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.visibleOnlyInElectron && !window.electron) return false;
    return item.title.toLowerCase().includes(menuQuery.toLowerCase());
  });

  const handleMenuKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMenuSelectedIndex(prev => (prev + 1) % filteredMenuItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMenuSelectedIndex(prev => (prev - 1 + filteredMenuItems.length) % filteredMenuItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredMenuItems[menuSelectedIndex]) {
        filteredMenuItems[menuSelectedIndex].action();
      }
    }
  };

  // --- Rendering Languages Helper ---
  const renderDropdownList = (type) => {
    const currentLang = type === "source" ? sourceLang : targetLang;
    const selectLang = (code) => {
      if (type === "source") {
        if (code === targetLang) {
          setTargetLang(sourceLang === "auto" ? "en" : sourceLang);
        }
        setSourceLang(code);
      } else {
        if (code === sourceLang) {
          setSourceLang(targetLang);
        }
        setTargetLang(code);
      }
      setActiveDropdown(null);
    };

    return (
      <div className="select-dropdown-list" ref={dropdownRef}>
        {Object.entries(LANGUAGE_MAP).map(([code, name]) => {
          if (type === "target" && code === "auto") return null;
          return (
            <div 
              key={code} 
              className={`select-item ${currentLang === code ? "selected" : ""}`}
              onClick={() => selectLang(code)}
            >
              <span>{name}</span>
              {currentLang === code && <Check size={14} />}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="palette-container" 
      data-theme={theme}
      style={{ "--card-opacity": opacity }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <Sparkles size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Palette Header */}
      <div className="palette-header">
        {/* Source Language Select */}
        <div className="header-left">
          {sourceLang !== "auto" && (
            <button className="back-btn" onClick={() => setSourceLang("auto")} title="Reset to Detect Language">
              <X size={16} />
            </button>
          )}
          <div className="select-wrapper">
            <button 
              className="select-trigger" 
              onClick={() => setActiveDropdown(activeDropdown === "source" ? null : "source")}
            >
              <span>{LANGUAGE_MAP[sourceLang] || sourceLang}</span>
              <ChevronDown size={16} />
            </button>
            {activeDropdown === "source" && renderDropdownList("source")}
          </div>
        </div>

        {/* Swap button absolute in center */}
        <div className="swap-btn-container">
          <button className="swap-btn" onClick={swapLanguages} title="Swap Languages">
            <ArrowLeftRight size={16} />
          </button>
        </div>

        {/* Target Language Select */}
        <div className="header-right">
          <div className="select-wrapper">
            <button 
              className="select-trigger" 
              onClick={() => setActiveDropdown(activeDropdown === "target" ? null : "target")}
            >
              <span>{LANGUAGE_MAP[targetLang] || targetLang}</span>
              <ChevronDown size={16} />
            </button>
            {activeDropdown === "target" && renderDropdownList("target")}
          </div>
        </div>

        {/* Desktop Custom Window Controls */}
        <div className="window-controls">
          <button 
            type="button" 
            className="control-btn" 
            onClick={() => {
              if (window.electron) window.electron.minimizeApp(); // Standard minimize to Windows taskbar
            }} 
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button 
            type="button" 
            className="control-btn" 
            onClick={() => {
              if (window.electron) window.electron.maximizeApp();
            }} 
            title="Maximize / Restore"
          >
            <Square size={12} />
          </button>
          <button 
            type="button" 
            className="control-btn" 
            onClick={() => {
              if (window.electron) window.electron.hideApp();
            }} 
            title="Close to Tray"
          >
            <X size={14} />
          </button>
          <button 
            type="button" 
            className="control-btn close-btn-window" 
            onClick={() => {
              if (window.electron) window.electron.closeApp(); // Completely close app
            }} 
            title="Quit Application"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Palette Body */}
      <div className="palette-body">
        {/* Left Input Panel */}
        <div className="panel-left">
          <textarea
            ref={inputRef}
            className="textarea-field"
            placeholder="Enter text..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="panel-footer">
            <button 
              className="tts-btn" 
              onClick={() => speakText(inputText, sourceLang)} 
              disabled={!inputText}
              title="Listen input text"
            >
              <Volume2 size={18} />
            </button>
            <span className="character-count">{inputText.length} chars</span>
          </div>
        </div>

        {/* Right Output Panel */}
        <div className="panel-right">
          {status === "error" ? (
            <div style={{ display: 'flex', gap: '8px', color: '#ef4444', fontSize: '0.95rem', lineHeight: '1.5' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMessage}</div>
            </div>
          ) : (
            <textarea
              className="textarea-field"
              placeholder="Translation"
              value={translatedText}
              readOnly
            />
          )}
          <div className="panel-footer">
            <button 
              className="tts-btn" 
              onClick={() => speakText(translatedText, targetLang)} 
              disabled={!translatedText || status === "error"}
              title="Listen translation"
            >
              <Volume2 size={18} />
            </button>
            {translatedText && (
              <button className="tts-btn" onClick={copyTranslation} title="Copy translation">
                <Copy size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Palette Footer */}
      {footerMode !== "hidden" && (
        <div className={`palette-footer ${footerMode === "hover" ? "footer-hover-mode" : ""}`}>
          <div className="footer-left">
            <span className={`status-indicator status-${status}`} />
            <Sparkles size={14} />
            <span>AuraTranslate{provider !== "google" ? ` (${provider === "appsScript" ? "Apps Script" : "Gemini"})` : ""}</span>
          </div>
          <div className="footer-right">
            <div className="shortcut-item">
              {renderKeycaps(shortcuts.copy)}
              <span>Copy Translation</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <div className="shortcut-item">
              <span className="key-cap">Ctrl</span>
              <span className="key-cap">K</span>
              <span>Actions</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <button className="settings-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
              <Settings size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal Overlay */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={saveSettings}>
            <div className="modal-header">
              <h3>AuraTranslate Settings</h3>
              <button type="button" className="close-btn" onClick={closeSettingsModal}>
                <X size={18} />
              </button>
            </div>
            
            {/* Tabs Selector */}
            <div style={{ padding: '0 24px' }}>
              <div className="settings-tabs">
                <button 
                  type="button"
                  className={`settings-tab-btn ${settingsTab === "general" ? "active" : ""}`}
                  onClick={() => setSettingsTab("general")}
                >
                  <Sliders size={14} />
                  <span>General</span>
                </button>
                <button 
                  type="button"
                  className={`settings-tab-btn ${settingsTab === "shortcuts" ? "active" : ""}`}
                  onClick={() => setSettingsTab("shortcuts")}
                >
                  <Keyboard size={14} />
                  <span>Shortcuts</span>
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ paddingTop: 0 }}>
              {settingsTab === "general" ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>App Theme</label>
                      <select 
                        className="form-control"
                        value={tempTheme}
                        onChange={(e) => setTempTheme(e.target.value)}
                      >
                        <option value="dark">Dark Theme</option>
                        <option value="light">Light Theme</option>
                        <option value="glass">macOS Frosted Glass</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Background Opacity ({Math.round(tempOpacity * 100)}%)</label>
                      <input 
                        type="range"
                        min="0.10"
                        max="1.00"
                        step="0.05"
                        className="form-control"
                        style={{ padding: '4px', height: '36px', cursor: 'pointer' }}
                        value={tempOpacity}
                        onChange={(e) => setTempOpacity(parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Footer Visibility</label>
                    <select 
                      className="form-control"
                      value={tempFooterMode}
                      onChange={(e) => setTempFooterMode(e.target.value)}
                    >
                      <option value="fixed">Always Visible (Fixed)</option>
                      <option value="hover">Appear on Mouse Hover</option>
                      <option value="hidden">Always Hidden (Disappear)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Translation Provider</label>
                    <select 
                      className="form-control"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    >
                      <option value="google">Google Translate (Free Web API)</option>
                      <option value="appsScript">Google Apps Script (Custom URL)</option>
                      <option value="gemini">Gemini API (Premium AI)</option>
                    </select>
                  </div>

                  {provider === "appsScript" && (
                    <div className="form-group">
                      <label>Google Apps Script Web App URL</label>
                      <input 
                        type="url"
                        className="form-control"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={tempAppsScriptUrl}
                        onChange={(e) => setTempAppsScriptUrl(e.target.value)}
                        required={provider === "appsScript"}
                      />
                    </div>
                  )}

                  {provider === "gemini" && (
                    <div className="form-group">
                      <label>Gemini API Key</label>
                      <input 
                        type="password"
                        className="form-control"
                        placeholder="AIzaSy..."
                        value={tempGeminiKey}
                        onChange={(e) => setTempGeminiKey(e.target.value)}
                        required={provider === "gemini"}
                      />
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label>Default Source Language</label>
                      <select 
                        className="form-control"
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value)}
                      >
                        {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                          <option key={code} value={code}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Default Target Language</label>
                      <select 
                        className="form-control"
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                      >
                        {Object.entries(LANGUAGE_MAP).map(([code, name]) => {
                          if (code === "auto") return null;
                          return <option key={code} value={code}>{name}</option>;
                        })}
                      </select>
                    </div>
                  </div>

                  {window.electron && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                        <input 
                          type="checkbox" 
                          id="startup-checkbox"
                          checked={tempOpenAtStartup}
                          onChange={(e) => setTempOpenAtStartup(e.target.checked)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        <label htmlFor="startup-checkbox" style={{ fontSize: '0.88rem', cursor: 'pointer', userSelect: 'none' }}>
                          Launch application automatically when Windows starts up
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                        <input 
                          type="checkbox" 
                          id="blur-checkbox"
                          checked={tempHideOnBlur}
                          onChange={(e) => setTempHideOnBlur(e.target.checked)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        <label htmlFor="blur-checkbox" style={{ fontSize: '0.88rem', cursor: 'pointer', userSelect: 'none' }}>
                          Hide application when clicking outside (deactivating this shows the app in taskbar)
                        </label>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Click in any box below and press your desired key combination to record a shortcut.
                  </div>

                  {window.electron && (
                    <div className="form-group">
                      <label>Global Show/Hide App Hotkey (Desktop wrapper only)</label>
                      <input 
                        type="text"
                        readOnly
                        className="shortcut-recorder-input"
                        placeholder="None"
                        value={recordingAction === "globalToggle" ? recordingShortcutText : formatShortcutDisplay(tempShortcuts.globalToggle)}
                        onKeyDown={(e) => handleRecordKeyDown(e, "globalToggle")}
                        onKeyUp={(e) => handleRecordKeyUp(e, "globalToggle")}
                        onFocus={() => startRecording("globalToggle")}
                      />
                    </div>
                  )}
 
                  <div className="form-row">
                    <div className="form-group">
                      <label>Copy Translation</label>
                      <input 
                        type="text"
                        readOnly
                        className="shortcut-recorder-input"
                        placeholder="None"
                        value={recordingAction === "copy" ? recordingShortcutText : formatShortcutDisplay(tempShortcuts.copy)}
                        onKeyDown={(e) => handleRecordKeyDown(e, "copy")}
                        onKeyUp={(e) => handleRecordKeyUp(e, "copy")}
                        onFocus={() => startRecording("copy")}
                      />
                    </div>
 
                    <div className="form-group">
                      <label>Swap Languages</label>
                      <input 
                        type="text"
                        readOnly
                        className="shortcut-recorder-input"
                        placeholder="None"
                        value={recordingAction === "swap" ? recordingShortcutText : formatShortcutDisplay(tempShortcuts.swap)}
                        onKeyDown={(e) => handleRecordKeyDown(e, "swap")}
                        onKeyUp={(e) => handleRecordKeyUp(e, "swap")}
                        onFocus={() => startRecording("swap")}
                      />
                    </div>
                  </div>
 
                  <div className="form-row">
                    <div className="form-group">
                      <label>Speak Source Text</label>
                      <input 
                        type="text"
                        readOnly
                        className="shortcut-recorder-input"
                        placeholder="None"
                        value={recordingAction === "speakInput" ? recordingShortcutText : formatShortcutDisplay(tempShortcuts.speakInput)}
                        onKeyDown={(e) => handleRecordKeyDown(e, "speakInput")}
                        onKeyUp={(e) => handleRecordKeyUp(e, "speakInput")}
                        onFocus={() => startRecording("speakInput")}
                      />
                    </div>
 
                    <div className="form-group">
                      <label>Speak Translation</label>
                      <input 
                        type="text"
                        readOnly
                        className="shortcut-recorder-input"
                        placeholder="None"
                        value={recordingAction === "speakTranslation" ? recordingShortcutText : formatShortcutDisplay(tempShortcuts.speakTranslation)}
                        onKeyDown={(e) => handleRecordKeyDown(e, "speakTranslation")}
                        onKeyUp={(e) => handleRecordKeyUp(e, "speakTranslation")}
                        onFocus={() => startRecording("speakTranslation")}
                      />
                    </div>
                  </div>
 
                  <div className="form-group">
                    <label>Clear Text</label>
                    <input 
                      type="text"
                      readOnly
                      className="shortcut-recorder-input"
                      placeholder="None"
                      value={recordingAction === "clear" ? recordingShortcutText : formatShortcutDisplay(tempShortcuts.clear)}
                      onKeyDown={(e) => handleRecordKeyDown(e, "clear")}
                      onKeyUp={(e) => handleRecordKeyUp(e, "clear")}
                      onFocus={() => startRecording("clear")}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeSettingsModal}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Settings</button>
            </div>
          </form>
        </div>
      )}

      {/* First-Time Welcome Tip Modal */}
      {showWelcomeTip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                Welcome to AuraTranslate!
              </h3>
            </div>
            <div className="modal-body" style={{ fontSize: '0.92rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '12px' }}>
                To keep the interface clean, the status bar footer is <strong>hidden by default</strong>.
              </p>
              <p style={{ marginBottom: '12px' }}>
                Simply <strong>hover your mouse over the bottom border</strong> of the window to reveal the footer where you can view active shortcuts and open <strong>Settings</strong> (or press <strong>Ctrl + ,</strong>).
              </p>
              <p>
                If you prefer the footer to always be visible, you can change the <strong>Footer Visibility</strong> setting inside the Settings menu.
              </p>
            </div>
            <div className="modal-footer" style={{ padding: '12px 24px' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={closeWelcomeTip}
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Menu Overlay (Ctrl + K) */}
      {isMenuOpen && (
        <div className="modal-overlay" onClick={() => setIsMenuOpen(false)}>
          <div className="menu-content" onClick={(e) => e.stopPropagation()}>
            <div className="menu-search-wrapper">
              <Search size={18} />
              <input 
                ref={menuSearchRef}
                className="menu-search-input"
                placeholder="Search command actions..."
                value={menuQuery}
                onChange={(e) => {
                  setMenuQuery(e.target.value);
                  setMenuSelectedIndex(0);
                }}
                onKeyDown={handleMenuKeyDown}
              />
            </div>
            <div className="menu-list">
              {filteredMenuItems.map((item, index) => {
                const Icon = item.icon;
                const active = index === menuSelectedIndex;
                return (
                  <div 
                    key={item.id}
                    className={`menu-item ${active ? "active" : ""}`}
                    onMouseEnter={() => setMenuSelectedIndex(index)}
                    onClick={item.action}
                  >
                    <div className="menu-item-info">
                      <Icon size={16} />
                      <span className="menu-item-title">{item.title}</span>
                    </div>
                    <div className="menu-item-shortcut">
                      {item.shortcut}
                      {active && (
                        <span className="key-cap" style={{ background: 'var(--accent)', color: '#fff' }}>
                          <CornerDownLeft size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredMenuItems.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No actions found matching "{menuQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
