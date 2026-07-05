; NSIS installer customizations for Nexora Enterprise
; This file is referenced by electron-builder in package.json

!macro customInstall
  ; Create a .env file from defaults if one doesn't exist
  IfFileExists "$INSTDIR\.env" env_exists
    CopyFiles "$INSTDIR\.env.defaults" "$INSTDIR\.env"
  env_exists:
!macroend
