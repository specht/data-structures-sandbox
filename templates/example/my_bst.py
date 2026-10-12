from sandbox import TreeNode


# Ordinary, UNBALANCED binary search tree.
# Duplicate policy: not allowed; inserting an existing value changes nothing.
# Compare sorted insertion orders with other insertion orders.
class MyBST:
    def __init__(self):
        self.root: TreeNode | None = None

    def insert(self, value: int) -> None:
        if self.root is None:
            self.root = TreeNode(value)
            return
        current: TreeNode | None = self.root
        while current is not None:
            if value == current.value:
                return
            if value < current.value:
                if current.left is None:
                    current.left = TreeNode(value)
                    return
                current = current.left
            else:
                if current.right is None:
                    current.right = TreeNode(value)
                    return
                current = current.right

    def contains(self, value: int) -> bool:
        current: TreeNode | None = self.root
        while current is not None:
            if value == current.value:
                return True
            current = current.left if value < current.value else current.right
        return False

    def remove(self, value: int) -> bool:
        parent: TreeNode | None = None
        current: TreeNode | None = self.root
        while current is not None and current.value != value:
            parent = current
            current = current.left if value < current.value else current.right
        if current is None:
            return False
        if current.left is not None and current.right is not None:
            successor_parent = current
            successor = current.right
            while successor.left is not None:
                successor_parent = successor
                successor = successor.left
            current.value = successor.value
            parent = successor_parent
            current = successor
        child = current.left if current.left is not None else current.right
        if parent is None:
            self.root = child
        elif parent.left is current:
            parent.left = child
        else:
            parent.right = child
        return True
