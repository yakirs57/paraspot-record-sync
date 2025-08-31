// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorBackgroundUploader",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorBackgroundUploader",
            targets: ["BackgroundUploaderPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "BackgroundUploaderPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/BackgroundUploaderPlugin"),
        .testTarget(
            name: "BackgroundUploaderPluginTests",
            dependencies: ["BackgroundUploaderPlugin"],
            path: "ios/Tests/BackgroundUploaderPluginTests")
    ]
)