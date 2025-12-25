#!/bin/bash

# Interactive Mode Example
# Demonstrates how to use Mind2Build in interactive mode

echo "=================================="
echo "Mind2Build Interactive Mode Demo"
echo "=================================="
echo ""

# Check if mind2build is available
if ! command -v mind2build &> /dev/null; then
    echo "❌ Error: mind2build command not found"
    echo "Please install Mind2Build first:"
    echo "  cd backend && npm install && npm link"
    exit 1
fi

# Set editor (optional)
echo "📝 Current editor: ${EDITOR:-vi}"
echo "   To change, set EDITOR environment variable:"
echo "   export EDITOR=nano  # or vim, code, emacs, etc."
echo ""

# Example 1: Simple calculator with interactive mode
echo "Example 1: Create a calculator (interactive mode)"
echo "Command: mind2build generate \"Create a simple calculator\" -i -o ./calculator-demo"
echo ""
read -p "Press Enter to continue or Ctrl+C to exit..."
echo ""

mind2build generate "Create a simple calculator with basic operations (add, subtract, multiply, divide)" \
  --interactive \
  --output ./calculator-demo \
  --budget 5.0 \
  --rounds 5

echo ""
echo "=================================="
echo "Example 1 completed!"
echo "Check the generated files in ./calculator-demo/"
echo ""

# Example 2: REST API with interactive mode
echo "Example 2: Create a REST API (interactive mode)"
echo "Command: mind2build generate \"Create a simple REST API\" -i -o ./api-demo"
echo ""
read -p "Press Enter to continue or Ctrl+C to exit..."
echo ""

mind2build generate "Create a simple REST API for a todo list with Express.js" \
  --interactive \
  --output ./api-demo \
  --budget 8.0 \
  --rounds 5

echo ""
echo "=================================="
echo "Example 2 completed!"
echo "Check the generated files in ./api-demo/"
echo ""

# Compare with automatic mode
echo "=================================="
echo "Comparison: Automatic Mode (no interaction)"
echo "=================================="
echo ""
echo "For comparison, let's generate the same project in automatic mode:"
echo "Command: mind2build generate \"Create a calculator\" -o ./calculator-auto"
echo ""
read -p "Press Enter to continue or Ctrl+C to exit..."
echo ""

mind2build generate "Create a simple calculator with basic operations" \
  --output ./calculator-auto \
  --budget 5.0 \
  --rounds 5

echo ""
echo "=================================="
echo "Automatic mode completed!"
echo "Compare the results:"
echo "  - Interactive: ./calculator-demo/"
echo "  - Automatic:   ./calculator-auto/"
echo ""

# Tips
echo "=================================="
echo "💡 Tips for Interactive Mode"
echo "=================================="
echo ""
echo "1. Use short commands for efficiency:"
echo "   c - continue"
echo "   e - edit"
echo "   r - regenerate"
echo "   v - view full content"
echo "   s - skip"
echo "   q - quit"
echo ""
echo "2. Set your preferred editor:"
echo "   export EDITOR=code   # VS Code"
echo "   export EDITOR=nano   # Nano (beginner-friendly)"
echo "   export EDITOR=vim    # Vim"
echo ""
echo "3. Review PRD and Design documents carefully:"
echo "   These are the foundation of your project!"
echo ""
echo "4. Use 'r' (regenerate) sparingly:"
echo "   Each regeneration consumes more tokens/budget"
echo ""
echo "5. Use 'e' (edit) for small changes:"
echo "   More efficient than regenerating"
echo ""

echo "=================================="
echo "Demo completed! Happy coding! 🚀"
echo "=================================="

