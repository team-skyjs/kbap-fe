require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "VisionCameraHands"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/kbap"
  s.license      = "UNLICENSED"
  s.authors      = "K-Bap"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/kbap/kbap-fe.git", :tag => "#{s.version}" }

  s.source_files = ["ios/**/*.{swift}", "ios/**/*.{m,mm}"]
  s.frameworks = ["AVFoundation", "Vision", "CoreMedia"]

  load 'nitrogen/generated/ios/VisionCameraHands+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'VisionCamera'
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
