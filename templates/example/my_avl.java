import sandbox.TreeNode;

// AVL tree. Height 1 means a leaf; null has height 0.
// Duplicate policy: not allowed; inserting an existing value changes nothing.
// Rotations relink existing TreeNode objects: node IDs remain stable.
class MyAVL {
    TreeNode root = null;

    public void insert(int value) {
        root = insert(root, value);
    }

    public boolean contains(int value) {
        TreeNode node = root;
        while (node != null) {
            if (value == node.value) return true;
            node = value < node.value ? node.left : node.right;
        }
        return false;
    }

    public boolean remove(int value) {
        if (!contains(value)) return false;
        root = remove(root, value);
        return true;
    }

    private int height(TreeNode node) {
        return node == null ? 0 : node.height;
    }

    private int balance(TreeNode node) {
        return height(node.left) - height(node.right);
    }

    private void refresh(TreeNode node) {
        node.height = 1 + Math.max(height(node.left), height(node.right));
    }

    private TreeNode rotateLeft(TreeNode node) {
        TreeNode newRoot = node.right;
        node.right = newRoot.left; // First retarget pointers, then move nodes.
        newRoot.left = node;
        refresh(node);
        refresh(newRoot);
        return newRoot;
    }

    private TreeNode rotateRight(TreeNode node) {
        TreeNode newRoot = node.left;
        node.left = newRoot.right;
        newRoot.right = node;
        refresh(node);
        refresh(newRoot);
        return newRoot;
    }

    private TreeNode rebalance(TreeNode node) {
        refresh(node);
        int balance = balance(node);
        if (balance > 1) {
            if (balance(node.left) < 0) node.left = rotateLeft(node.left);
            return rotateRight(node);
        }
        if (balance < -1) {
            if (balance(node.right) > 0) node.right = rotateRight(node.right);
            return rotateLeft(node);
        }
        return node;
    }

    private TreeNode insert(TreeNode node, int value) {
        if (node == null) return new TreeNode(value);
        if (value < node.value) {
            node.left = insert(node.left, value);
        } else if (value > node.value) {
            node.right = insert(node.right, value);
        } else {
            return node;
        }
        return rebalance(node);
    }

    private TreeNode remove(TreeNode node, int value) {
        if (node == null) return null;
        if (value < node.value) {
            node.left = remove(node.left, value);
        } else if (value > node.value) {
            node.right = remove(node.right, value);
        } else {
            if (node.left == null) return node.right;
            if (node.right == null) return node.left;
            // Replace this node's key with its in-order successor, then remove
            // the successor from the right subtree. The node ID is preserved.
            TreeNode successor = node.right;
            while (successor.left != null) {
                successor = successor.left;
            }
            node.value = successor.value;
            node.right = remove(node.right, successor.value);
        }
        return rebalance(node);
    }
}
