// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "LocalDocsSearch",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "LocalDocsSearch")
    ]
)
