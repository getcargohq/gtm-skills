import {
  Button,
  List,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cargo-ai/app-sdk";
import { Download } from "lucide-react";
import React from "react";

import { downloadCsv, toCsv, useBoard } from "../data";
import { BoardState, ExternalAnchor } from "../shared";

export const Posts: React.FC = () => {
  const { data, isLoading, error } = useBoard();

  return (
    <List
      title="Posts"
      description="Your posts, by how many ICP people they pulled. Raw reach says what travelled; ICP share says what reached buyers."
    >
      <BoardState isLoading={isLoading} error={error} board={data}>
        {(board) => {
          const exportRows = () =>
            downloadCsv(
              `posts-${board.loadedAt.toISOString().slice(0, 10)}.csv`,
              toCsv(
                [
                  "post_date",
                  "author",
                  "post_url",
                  "engagers",
                  "icp_engagers",
                  "icp_share",
                  "comments",
                  "repeat_engagers",
                  "excerpt",
                ],
                board.posts.map((post) => [
                  post.postDate,
                  post.author.name,
                  post.postUrl,
                  post.engagers,
                  post.icpEngagers,
                  post.engagers > 0
                    ? (post.icpEngagers / post.engagers).toFixed(2)
                    : "0",
                  post.comments,
                  post.repeatEngagers,
                  post.excerpt.replace(/\s+/g, " "),
                ]),
              ),
            );
          return (
            <div className="px-6 pb-6">
              <div className="mb-3 flex justify-end">
                <Button variant="outline" size="sm" onClick={exportRows}>
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead className="text-right">Engagers</TableHead>
                    <TableHead className="text-right">ICP</TableHead>
                    <TableHead className="text-right">ICP share</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Repeat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.posts.map((post) => (
                    <TableRow key={post.postUrl}>
                      <TableCell className="max-w-md">
                        <ExternalAnchor href={post.postUrl}>
                          {post.postDate}
                        </ExternalAnchor>
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {post.excerpt}
                        </div>
                      </TableCell>
                      <TableCell>{post.author.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.engagers}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {post.icpEngagers}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.engagers > 0
                          ? `${Math.round((100 * post.icpEngagers) / post.engagers)}%`
                          : "0%"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.comments}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.repeatEngagers}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                Repeat: engagers who have engaged with 2 or more of our posts.
                Cargo Signals only watches posts from the last month, so
                engagement a post gets after that is not counted.
              </p>
            </div>
          );
        }}
      </BoardState>
    </List>
  );
};
