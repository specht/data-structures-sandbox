from sandbox import TreeNode


# AVL tree. Height 1 means a leaf; None has height 0.
# Duplicate policy: not allowed; inserting an existing value changes nothing.
# Rotations relink existing TreeNode objects: node IDs remain stable.
class MyAVL:
    def __init__(self):
        self.root: TreeNode | None = None

    def insert(self, value: int) -> None:
        self.root = self._insert(self.root, value)

    def contains(self, value: int) -> bool:
        node: TreeNode | None = self.root
        while node is not None:
            if value == node.value:
                return True
            node = node.left if value < node.value else node.right
        return False

    def remove(self, value: int) -> bool:
        if not self.contains(value):
            return False
        self.root = self._remove(self.root, value)
        return True

    def _height(self, node: TreeNode | None) -> int:
        return 0 if node is None else node.height

    def _balance(self, node: TreeNode) -> int:
        return self._height(node.left) - self._height(node.right)

    def _refresh(self, node: TreeNode) -> None:
        node.height = 1 + max(self._height(node.left), self._height(node.right))

    def _rotate_left(self, node: TreeNode) -> TreeNode:
        new_root = node.right
        node.right = new_root.left  # First retarget pointers, then move nodes.
        new_root.left = node
        self._refresh(node)
        self._refresh(new_root)
        return new_root

    def _rotate_right(self, node: TreeNode) -> TreeNode:
        new_root = node.left
        node.left = new_root.right
        new_root.right = node
        self._refresh(node)
        self._refresh(new_root)
        return new_root

    def _rebalance(self, node: TreeNode) -> TreeNode:
        self._refresh(node)
        balance = self._balance(node)
        if balance > 1:
            if self._balance(node.left) < 0:
                node.left = self._rotate_left(node.left)
            return self._rotate_right(node)
        if balance < -1:
            if self._balance(node.right) > 0:
                node.right = self._rotate_right(node.right)
            return self._rotate_left(node)
        return node

    def _insert(self, node: TreeNode | None, value: int) -> TreeNode:
        if node is None:
            return TreeNode(value)
        if value < node.value:
            node.left = self._insert(node.left, value)
        elif value > node.value:
            node.right = self._insert(node.right, value)
        else:
            return node
        return self._rebalance(node)

    def _remove(self, node: TreeNode | None, value: int) -> TreeNode | None:
        if node is None:
            return None
        if value < node.value:
            node.left = self._remove(node.left, value)
        elif value > node.value:
            node.right = self._remove(node.right, value)
        else:
            if node.left is None:
                return node.right
            if node.right is None:
                return node.left
            # Replace this node's key with its in-order successor, then remove
            # the successor from the right subtree. The node ID is preserved.
            successor = node.right
            while successor.left is not None:
                successor = successor.left
            node.value = successor.value
            node.right = self._remove(node.right, successor.value)
        return self._rebalance(node)
