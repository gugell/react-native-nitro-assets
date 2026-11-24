require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroAssets"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/gugell/react-native-nitro-assets"
  s.license      = package["license"]
  s.authors      = package["author"]

  # Background Assets needs iOS 26; older systems use On-Demand Resources (NSBundleResourceRequest).
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/gugell/react-native-nitro-assets.git", :tag => "v#{s.version}" }

  s.source_files = [
    "ios/**/*.{swift}",
  ]
  # Weak: the framework exists only on iOS 26+, and the module also runs on older systems.
  s.weak_frameworks = "BackgroundAssets"

  load 'nitrogen/generated/ios/NitroAssets+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
