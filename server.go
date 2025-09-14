package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	vaultPath string
	pwaPath   string
	port      int
)

func main() {
	// 1. Argument Parsing
	flag.StringVar(&vaultPath, "vault", "", "Path to the Obsidian vault")
	flag.StringVar(&pwaPath, "pwa", ".", "Path to the PWA root")
	flag.IntVar(&port, "port", 8443, "Port to serve on")
	flag.Parse()

	if vaultPath == "" {
		log.Fatal("Vault path is required. Please use the -vault flag.")
	}

	// Ensure paths are absolute
	absVaultPath, err := filepath.Abs(vaultPath)
	if err != nil {
		log.Fatalf("Could not get absolute path for vault: %v", err)
	}
	vaultPath = absVaultPath

	absPwaPath, err := filepath.Abs(pwaPath)
	if err != nil {
		log.Fatalf("Could not get absolute path for PWA root: %v", err)
	}
	pwaPath = absPwaPath

	log.Printf("Vault Path: %s", vaultPath)
	log.Printf("PWA Path:   %s", pwaPath)
	log.Printf("Port:       %d", port)

	// 2. Certificate Generation
	certFile := "cert.pem"
	keyFile := "key.pem"
	if _, err := os.Stat(certFile); os.IsNotExist(err) {
		log.Println("Generating cert.pem and key.pem...")
		generateCert(certFile, keyFile)
	}

	// 3. API Handlers
	http.HandleFunc("/api/files", handleListFiles)
	http.HandleFunc("/api/files/read", handleReadFile)
	http.HandleFunc("/api/files/write", handleWriteFile)
	http.HandleFunc("/api/files/create", handleCreateFile)
	http.HandleFunc("/api/files/rename", handleRenameFile)

	// 4. Custom File Server with Middleware for index.html injection
	// The file server is rooted at pwaPath (e.g., the project root ".")
	fileServer := http.FileServer(http.Dir(pwaPath))
	http.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Diagnostic logging to see every request path.
		log.Printf("Request received for: %s", r.URL.Path)

		// The user accesses the PWA via the /pwa/ directory. We must match this path.
		if r.URL.Path == "/pwa/" || r.URL.Path == "/pwa/index.html" {
			// The file on disk is located at "pwa/index.html" relative to the pwaPath.
			serveIndex(w, r, "pwa/index.html")
			return
		}
		// For all other files, let the file server handle it.
		// A request for /pwa/main.js will be correctly found by the file server
		// at the path ./pwa/main.js on the filesystem.
		fileServer.ServeHTTP(w, r)
	}))

	// 5. Start Server
	addr := fmt.Sprintf(":%d", port)
	log.Printf("Serving PWA from '%s' on https://localhost%s", pwaPath, addr)
	log.Printf("API is available at https://localhost%s/api", addr)
	err = http.ListenAndServeTLS(addr, certFile, keyFile, nil)
	if err != nil {
		log.Fatal(err)
	}
}

func serveIndex(w http.ResponseWriter, r *http.Request, diskPath string) {
	log.Printf("Serving modified index.html for request: %s", r.URL.Path)

	// The actual path on disk to the index.html file.
	indexPath := filepath.Join(pwaPath, diskPath)
	content, err := os.ReadFile(indexPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Could not read index.html from %s: %v", indexPath, err), http.StatusInternalServerError)
		return
	}

	// The script to inject
	script := "<script>window.__OLIVINE_MODE__ = 'remote';</script>"

	// Replace the placeholder with the actual script
	modifiedContent := strings.Replace(string(content), "<!--INJECT_OLIVINE_MODE-->", script, 1)

	// Set headers to prevent caching
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(modifiedContent))
}

// --- API Handler Implementations ---

func handleListFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var files []string
	err := filepath.WalkDir(vaultPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		// Check if the file or directory name starts with a dot.
		if strings.HasPrefix(d.Name(), ".") {
			// If it's a directory, skip processing its contents.
			if d.IsDir() {
				return filepath.SkipDir
			}
			// If it's a file, just skip this single file.
			return nil
		}

		if !d.IsDir() && filepath.Ext(path) == ".md" {
			relativePath, err := filepath.Rel(vaultPath, path)
			if err != nil {
				return err
			}
			files = append(files, relativePath)
		}
		return nil
	})

	if err != nil {
		http.Error(w, fmt.Sprintf("Error walking vault path: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func handleReadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	// Security: Prevent directory traversal
	fullPath := filepath.Join(vaultPath, filePath)
	cleanPath, err := filepath.Abs(fullPath)
	if err != nil {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}
	if !filepath.HasPrefix(cleanPath, vaultPath) {
		http.Error(w, "Invalid file path (traversal attempt)", http.StatusBadRequest)
		return
	}

	content, err := os.ReadFile(cleanPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error reading file: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]string{"content": string(content)}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type WriteRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func handleWriteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req WriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	fullPath := filepath.Join(vaultPath, req.Path)
	cleanPath, err := filepath.Abs(fullPath)
	if err != nil {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}
	if !filepath.HasPrefix(cleanPath, vaultPath) {
		http.Error(w, "Invalid file path (traversal attempt)", http.StatusBadRequest)
		return
	}

	// Ensure directory exists
	dir := filepath.Dir(cleanPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		http.Error(w, fmt.Sprintf("Could not create directory: %v", err), http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(cleanPath, []byte(req.Content), 0644); err != nil {
		http.Error(w, fmt.Sprintf("Error writing file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

type CreateRequest struct {
	Path string `json:"path"`
}

func handleCreateFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	fullPath := filepath.Join(vaultPath, req.Path)
	cleanPath, err := filepath.Abs(fullPath)
	if err != nil {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}
	if !filepath.HasPrefix(cleanPath, vaultPath) {
		http.Error(w, "Invalid file path (traversal attempt)", http.StatusBadRequest)
		return
	}

	// Ensure directory exists
	dir := filepath.Dir(cleanPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		http.Error(w, fmt.Sprintf("Could not create directory: %v", err), http.StatusInternalServerError)
		return
	}

	// Create empty file
	file, err := os.Create(cleanPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Could not create file: %v", err), http.StatusInternalServerError)
		return
	}
	file.Close()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

type RenameRequest struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
}

func handleRenameFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RenameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	oldFullPath := filepath.Join(vaultPath, req.OldPath)
	newFullPath := filepath.Join(vaultPath, req.NewPath)

	cleanOldPath, err := filepath.Abs(oldFullPath)
	if err != nil {
		http.Error(w, "Invalid old file path", http.StatusBadRequest)
		return
	}
	cleanNewPath, err := filepath.Abs(newFullPath)
	if err != nil {
		http.Error(w, "Invalid new file path", http.StatusBadRequest)
		return
	}

	if !filepath.HasPrefix(cleanOldPath, vaultPath) || !filepath.HasPrefix(cleanNewPath, vaultPath) {
		http.Error(w, "Invalid file path (traversal attempt)", http.StatusBadRequest)
		return
	}

	// Ensure new directory exists
	newDir := filepath.Dir(cleanNewPath)
	if err := os.MkdirAll(newDir, 0755); err != nil {
		http.Error(w, fmt.Sprintf("Could not create directory for new path: %v", err), http.StatusInternalServerError)
		return
	}

	if err := os.Rename(cleanOldPath, cleanNewPath); err != nil {
		http.Error(w, fmt.Sprintf("Error renaming file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// --- Certificate Generation ---

func generateCert(certFile, keyFile string) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{Organization: []string{"Local Dev"}},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(time.Hour * 24 * 365),
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"localhost"},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		log.Fatal(err)
	}

	certOut, err := os.Create(certFile)
	if err != nil {
		log.Fatalf("Failed to create %s: %v", certFile, err)
	}
	defer certOut.Close()
	pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: derBytes})

	keyOut, err := os.Create(keyFile)
	if err != nil {
		log.Fatalf("Failed to create %s: %v", keyFile, err)
	}
	defer keyOut.Close()
	pem.Encode(keyOut, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)})
}
