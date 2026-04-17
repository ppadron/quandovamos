import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["source", "status"]
  static values = {
    copiedLabel: { type: String, default: "Copiado!" }
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.sourceTarget.value)
      if (this.hasStatusTarget) this.statusTarget.textContent = this.copiedLabelValue
    } catch (_e) {
      this.sourceTarget.focus()
      this.sourceTarget.select()
    }
  }
}
