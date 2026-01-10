import React from 'react';
import { ArrowLeft, Zap, Shield, Lock, Globe, Server, Eye } from 'lucide-react';

interface InfoProps {
  onBack: () => void;
}

export const Info: React.FC<InfoProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      <div className="fixed inset-0 bg-black/20" />
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-gradient-shift" />
      
      <div className="relative z-10 mx-auto px-4 py-6 max-w-4xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>

        <div className="glass-card p-8">
          <h1 className="text-3xl font-bold text-white mb-6">How It Works</h1>

          <div className="space-y-8 text-white/80">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                <Zap size={24} className="text-yellow-400" />
                True Peer-to-Peer Transfer
              </h2>
              <p className="leading-relaxed mb-4">
                Unlike traditional file sharing services that upload your files to a server, this service uses 
                <strong className="text-white"> WebRTC technology</strong> to transfer files directly between browsers. 
                Your files never touch our servers - they go straight from sender to receiver.
              </p>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm text-white/70">
                  <strong className="text-blue-400">Traditional:</strong> Your File → Server → Recipient<br />
                  <strong className="text-green-400">P2P (This Service):</strong> Your File → Recipient (Direct)
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                <Shield size={24} className="text-green-400" />
                Privacy First
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Eye size={20} className="text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white">No File Storage</h3>
                    <p className="text-sm">We never store your files. They're transferred directly between peers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lock size={20} className="text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white">End-to-End Encryption</h3>
                    <p className="text-sm">WebRTC connections are encrypted by default. Your data is secure in transit.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Server size={20} className="text-orange-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white">Minimal Metadata</h3>
                    <p className="text-sm">We only store filename, size, and peer IDs temporarily (24 hours) to facilitate connections.</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">How to Use</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                    Sending Files
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 ml-8 text-sm">
                    <li>Drag and drop your file(s) or click to select</li>
                    <li>Optionally enable PIN protection (4-digit code)</li>
                    <li>Click "Create Share Link"</li>
                    <li>Share the generated link with your recipient</li>
                    <li>Keep the page open until transfer completes</li>
                  </ol>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                    Receiving Files
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 ml-8 text-sm">
                    <li>Open the share link in your browser</li>
                    <li>Enter the PIN if the file is protected</li>
                    <li>Review the file details and security warnings</li>
                    <li>Click "Start Download" and choose save location</li>
                    <li>Wait for the transfer to complete</li>
                  </ol>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                <Lock size={24} className="text-blue-400" />
                PIN Protection
              </h2>
              <p className="leading-relaxed mb-3">
                Add an extra layer of security to your file shares:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                <li>Optional 4-digit PIN code</li>
                <li>PIN is hashed and stored securely (bcrypt)</li>
                <li>Rate limiting: 5 attempts per 15 minutes prevents brute force</li>
                <li>Recipients must enter correct PIN to access file</li>
                <li>Share PIN separately from the link for maximum security</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                <Globe size={24} className="text-green-400" />
                Technical Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="font-semibold text-white mb-2">Technology Stack</h3>
                  <ul className="text-sm space-y-1">
                    <li>• WebRTC DataChannels</li>
                    <li>• PeerJS for signaling</li>
                    <li>• Browser-native encryption</li>
                    <li>• React frontend</li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="font-semibold text-white mb-2">Limitations</h3>
                  <ul className="text-sm space-y-1">
                    <li>• Both users must be online</li>
                    <li>• Links expire after 24 hours</li>
                    <li>• Corporate firewalls may block</li>
                    <li>• Browser memory limits apply</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Security Best Practices</h2>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 flex-shrink-0">⚠️</span>
                    <span>Only download files from people you trust</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 flex-shrink-0">⚠️</span>
                    <span>Scan executable files with antivirus before running</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 flex-shrink-0">⚠️</span>
                    <span>Verify sender identity through a separate channel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 flex-shrink-0">⚠️</span>
                    <span>Use PIN protection for sensitive files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 flex-shrink-0">⚠️</span>
                    <span>Share PINs separately from links (different channel)</span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="border-t border-white/20 pt-6 mt-6">
              <h2 className="text-xl font-semibold text-white mb-3">Why Choose P2P?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl mb-2">🚀</div>
                  <h3 className="font-semibold text-white mb-1">Fast</h3>
                  <p className="text-xs">Direct connection = maximum speed</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">🔒</div>
                  <h3 className="font-semibold text-white mb-1">Private</h3>
                  <p className="text-xs">No server storage or logging</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">💰</div>
                  <h3 className="font-semibold text-white mb-1">Free</h3>
                  <p className="text-xs">No file size limits or subscriptions</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
