import SwiftUI
import AppKit

@main
struct LocalDocsSearchApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup("localdocs") {
            SearchView()
                .frame(minWidth: 640, minHeight: 420)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

struct SearchResult: Identifiable {
    let id = UUID()
    let treePath: String
    let url: String
    let snippet: String
}

struct SearchView: View {
    @State private var query = ""
    @State private var results: [SearchResult] = []
    @State private var isSearching = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search your local docs…", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .onSubmit { runSearch() }
                if isSearching {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(12)

            Divider()

            if let err = errorMessage {
                ScrollView {
                    Text(err)
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                }
            } else if results.isEmpty && !isSearching {
                VStack(spacing: 8) {
                    Image(systemName: "books.vertical")
                        .font(.system(size: 32))
                        .foregroundStyle(.secondary)
                    Text("Type a query and hit return")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(results) { r in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(r.treePath)
                            .font(.headline)
                        Text(r.url)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Text(r.snippet)
                            .font(.body)
                            .lineLimit(3)
                            .foregroundStyle(.primary.opacity(0.85))
                    }
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if let url = URL(string: r.url) {
                            NSWorkspace.shared.open(url)
                        }
                    }
                }
                .listStyle(.inset)
            }
        }
    }

    private func runSearch() {
        guard !query.isEmpty, !isSearching else { return }
        let q = query
        isSearching = true
        errorMessage = nil
        results = []

        Task.detached {
            let outcome = runLocalDocs(query: q)
            await MainActor.run {
                isSearching = false
                switch outcome {
                case .success(let text):
                    results = parseResults(text)
                    if results.isEmpty {
                        errorMessage = text.isEmpty ? "No results." : text
                    }
                case .failure(let err):
                    errorMessage = err
                }
            }
        }
    }
}

enum LocalDocsOutcome {
    case success(String)
    case failure(String)
}

func runLocalDocs(query: String) -> LocalDocsOutcome {
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/bin/zsh")
    let escaped = query.replacingOccurrences(of: "\"", with: "\\\"")
    task.arguments = ["-lc", "localdocs search \"\(escaped)\""]

    let stdout = Pipe()
    let stderr = Pipe()
    task.standardOutput = stdout
    task.standardError = stderr

    do {
        try task.run()
        task.waitUntilExit()
    } catch {
        return .failure("Failed to launch localdocs: \(error.localizedDescription)")
    }

    let out = String(data: stdout.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let err = String(data: stderr.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""

    if task.terminationStatus != 0 {
        return .failure(err.isEmpty ? "localdocs exited with status \(task.terminationStatus)" : err)
    }
    return .success(out)
}

func parseResults(_ raw: String) -> [SearchResult] {
    let lines = raw.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    var results: [SearchResult] = []
    var i = 0
    while i < lines.count {
        let line = lines[i].trimmingCharacters(in: .whitespaces)
        if let lb = line.firstIndex(of: "["),
           let rb = line.firstIndex(of: "]"),
           lb < rb {
            let path = String(line[line.index(after: lb)..<rb])
            let url = i + 1 < lines.count ? lines[i + 1].trimmingCharacters(in: .whitespaces) : ""
            let snippet = i + 2 < lines.count ? lines[i + 2].trimmingCharacters(in: .whitespaces) : ""
            results.append(SearchResult(treePath: path, url: url, snippet: snippet))
            i += 3
        } else {
            i += 1
        }
    }
    return results
}
