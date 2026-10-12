import sandbox.TreeNode;

// Ordinary, UNBALANCED binary search tree.
// Duplicate policy: not allowed; inserting an existing value changes nothing.
// Compare sorted insertion orders with other insertion orders.
class MyBST {
    TreeNode root = null;

    public void insert(int value) {
        if (root == null) {
            root = new TreeNode(value);
            return;
        }
        TreeNode current = root;
        while (current != null) {
            if (value == current.value) return;
            if (value < current.value) {
                if (current.left == null) {
                    current.left = new TreeNode(value);
                    return;
                }
                current = current.left;
            } else {
                if (current.right == null) {
                    current.right = new TreeNode(value);
                    return;
                }
                current = current.right;
            }
        }
    }

    public boolean contains(int value) {
        TreeNode current = root;
        while (current != null) {
            if (value == current.value) return true;
            current = value < current.value ? current.left : current.right;
        }
        return false;
    }

    public boolean remove(int value) {
        TreeNode parent = null;
        TreeNode current = root;
        while (current != null && current.value != value) {
            parent = current;
            current = value < current.value ? current.left : current.right;
        }
        if (current == null) return false;
        if (current.left != null && current.right != null) {
            TreeNode successorParent = current;
            TreeNode successor = current.right;
            while (successor.left != null) {
                successorParent = successor;
                successor = successor.left;
            }
            current.value = successor.value;
            parent = successorParent;
            current = successor;
        }
        TreeNode child = current.left != null ? current.left : current.right;
        if (parent == null) {
            root = child;
        } else if (parent.left == current) {
            parent.left = child;
        } else {
            parent.right = child;
        }
        return true;
    }
}
